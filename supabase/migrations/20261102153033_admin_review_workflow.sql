CREATE TABLE IF NOT EXISTS public.admin_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned', 'assigned', 'in_progress', 'blocked', 'completed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT admin_review_tasks_assignment_status_check CHECK (
    (status = 'unassigned' AND assigned_to IS NULL)
    OR (status <> 'unassigned' AND assigned_to IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS admin_review_tasks_assigned_status_idx
  ON public.admin_review_tasks (assigned_to, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_review_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.admin_review_tasks(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('assigned', 'claimed', 'released', 'status_changed', 'moderated')),
  previous_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_status TEXT,
  next_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_review_task_events_property_created_idx
  ON public.admin_review_task_events (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_review_task_events_created_idx
  ON public.admin_review_task_events (created_at DESC);

ALTER TABLE public.admin_review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_review_task_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_review_tasks FROM anon, authenticated;
REVOKE ALL ON public.admin_review_task_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_review_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_review_task_events TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_review_task(
  p_property_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_assignee_id UUID,
  p_status TEXT,
  p_expected_version INTEGER,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_property_status TEXT;
  v_task public.admin_review_tasks%ROWTYPE;
  v_previous_assignee UUID;
  v_previous_status TEXT;
  v_next_assignee UUID;
  v_next_status TEXT;
  v_event_action TEXT;
BEGIN
  SELECT properties.status::TEXT
    INTO v_property_status
    FROM public.properties
    WHERE properties.id = p_property_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'property_not_found');
  END IF;

  IF v_property_status NOT IN ('pending', 'pending_review', 'under_review') THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'property_not_pending');
  END IF;

  SELECT *
    INTO v_task
    FROM public.admin_review_tasks
    WHERE property_id = p_property_id
    FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS DISTINCT FROM v_task.version THEN
      RETURN jsonb_build_object('success', FALSE, 'code', 'stale_version', 'version', v_task.version);
    END IF;
    v_previous_assignee := v_task.assigned_to;
    v_previous_status := v_task.status;
  ELSE
    IF p_expected_version <> 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'code', 'stale_version', 'version', 0);
    END IF;
    v_previous_assignee := NULL;
    v_previous_status := 'unassigned';
  END IF;

  v_next_assignee := v_previous_assignee;
  v_next_status := v_previous_status;

  CASE p_action
    WHEN 'assign' THEN
      IF p_assignee_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'assignee_required');
      END IF;
      v_next_assignee := p_assignee_id;
      v_next_status := 'assigned';
      v_event_action := 'assigned';
    WHEN 'claim' THEN
      IF v_task.id IS NOT NULL AND (
        v_task.assigned_to IS NOT NULL OR v_task.status = 'completed'
      ) THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'already_assigned');
      END IF;
      v_next_assignee := p_actor_id;
      v_next_status := 'in_progress';
      v_event_action := 'claimed';
    WHEN 'release' THEN
      IF v_task.id IS NULL OR v_task.status = 'completed' THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'task_not_releasable');
      END IF;
      IF v_task.assigned_to IS DISTINCT FROM p_actor_id AND NOT p_force THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'not_assigned_to_actor');
      END IF;
      v_next_assignee := NULL;
      v_next_status := 'unassigned';
      v_event_action := 'released';
    WHEN 'status' THEN
      IF p_status NOT IN ('in_progress', 'blocked') THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_status');
      END IF;
      IF v_task.id IS NULL OR v_task.status = 'completed' THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'task_not_active');
      END IF;
      IF v_task.assigned_to IS DISTINCT FROM p_actor_id AND NOT p_force THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'not_assigned_to_actor');
      END IF;
      v_next_status := p_status;
      v_event_action := 'status_changed';
    ELSE
      RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_action');
  END CASE;

  IF p_assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.profiles
      WHERE profiles.id = p_assignee_id
        AND profiles.role::TEXT = 'admin'
        AND COALESCE(profiles.is_suspended, FALSE) = FALSE
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_assignee');
  END IF;

  IF v_task.id IS NULL THEN
    INSERT INTO public.admin_review_tasks (
      property_id, assigned_to, assigned_by, status, version
    )
    VALUES (
      p_property_id, v_next_assignee, p_actor_id, v_next_status, 1
    )
    RETURNING * INTO v_task;
  ELSE
    UPDATE public.admin_review_tasks
      SET assigned_to = v_next_assignee,
          assigned_by = CASE WHEN p_action IN ('assign', 'claim') THEN p_actor_id ELSE assigned_by END,
          status = v_next_status,
          version = version + 1,
          updated_at = NOW(),
          completed_at = NULL
      WHERE id = v_task.id
      RETURNING * INTO v_task;
  END IF;

  INSERT INTO public.admin_review_task_events (
    task_id, property_id, actor_id, action,
    previous_assignee, next_assignee, previous_status, next_status
  )
  VALUES (
    v_task.id, p_property_id, p_actor_id, v_event_action,
    v_previous_assignee, v_next_assignee, v_previous_status, v_next_status
  );

  RETURN jsonb_build_object('success', TRUE, 'task', to_jsonb(v_task));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_review_property(
  p_property_id UUID,
  p_actor_id UUID,
  p_expected_status TEXT,
  p_target_status TEXT,
  p_reason TEXT,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_task public.admin_review_tasks%ROWTYPE;
  v_next_task_status TEXT;
BEGIN
  SELECT *
    INTO v_property
    FROM public.properties
    WHERE id = p_property_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'property_not_found');
  END IF;

  IF v_property.status::TEXT IS DISTINCT FROM p_expected_status THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'stale_status', 'status', v_property.status::TEXT);
  END IF;

  IF p_target_status NOT IN ('active', 'rejected', 'suspended', 'pending_review') THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_status');
  END IF;

  IF p_target_status IN ('active', 'rejected')
    AND v_property.status::TEXT NOT IN ('pending', 'pending_review', 'under_review') THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_transition', 'status', v_property.status::TEXT);
  END IF;

  IF p_target_status = 'suspended'
    AND v_property.status::TEXT NOT IN ('active', 'published') THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_transition', 'status', v_property.status::TEXT);
  END IF;

  IF p_target_status = 'pending_review'
    AND v_property.status::TEXT NOT IN ('rejected', 'suspended') THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'invalid_transition', 'status', v_property.status::TEXT);
  END IF;

  SELECT *
    INTO v_task
    FROM public.admin_review_tasks
    WHERE property_id = p_property_id
    FOR UPDATE;

  IF FOUND AND v_task.assigned_to IS NOT NULL
    AND v_task.assigned_to IS DISTINCT FROM p_actor_id
    AND NOT p_force THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'assigned_to_other');
  END IF;

  UPDATE public.properties
    SET status = p_target_status::public.property_status_enum,
        moderation_notes = p_reason,
        approved_at = CASE WHEN p_target_status = 'active' THEN NOW() ELSE NULL END,
        published_at = CASE WHEN p_target_status = 'active' THEN NOW() ELSE NULL END,
        moderated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_property_id
    RETURNING * INTO v_property;

  IF FOUND THEN
    IF v_task.id IS NOT NULL THEN
      v_next_task_status := CASE
        WHEN p_target_status = 'pending_review' THEN 'in_progress'
        ELSE 'completed'
      END;

      UPDATE public.admin_review_tasks
        SET status = v_next_task_status,
            version = version + 1,
            updated_at = NOW(),
            completed_at = CASE WHEN v_next_task_status = 'completed' THEN NOW() ELSE NULL END
        WHERE id = v_task.id;

      INSERT INTO public.admin_review_task_events (
        task_id, property_id, actor_id, action,
        previous_assignee, next_assignee, previous_status, next_status,
        details
      )
      VALUES (
        v_task.id, p_property_id, p_actor_id, 'moderated',
        v_task.assigned_to, v_task.assigned_to, v_task.status, v_next_task_status,
        jsonb_build_object('from_property_status', p_expected_status, 'to_property_status', p_target_status)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'property', to_jsonb(v_property));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_review_task(UUID, UUID, TEXT, UUID, TEXT, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_moderate_review_property(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_review_task(UUID, UUID, TEXT, UUID, TEXT, INTEGER, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_moderate_review_property(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN)
  TO service_role;
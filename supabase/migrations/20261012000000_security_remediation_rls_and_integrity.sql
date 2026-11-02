-- ==============================================================================
-- Migration: 20261012000000_security_remediation_rls_and_integrity.sql
-- Description:
--   Hardened Row Level Security (RLS) policies and indexes for properties,
--   property_images, inquiries, inquiry_messages, property_reports, and audit_events.
--   Enforces participant isolation, protects private messages and internal admin
--   notes, and optimizes RLS evaluation via (SELECT auth.uid()).
-- ==============================================================================

-- 1. Ensure Core Tables Exist Safely
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    seeker_id UUID,
    seeker_name TEXT NOT NULL,
    seeker_phone TEXT NOT NULL,
    seeker_email TEXT,
    advertiser_id UUID,
    message TEXT NOT NULL,
    preferred_contact VARCHAR NOT NULL DEFAULT 'in_app',
    status VARCHAR NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiry_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_name TEXT NOT NULL,
    sender_role VARCHAR NOT NULL DEFAULT 'buyer',
    content TEXT NOT NULL,
    is_admin_note BOOLEAN NOT NULL DEFAULT false,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    reporter_id UUID,
    reporter_name TEXT NOT NULL DEFAULT 'مستخدم مجهول',
    reporter_phone TEXT,
    reason_category VARCHAR NOT NULL DEFAULT 'other',
    details TEXT NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending',
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR NOT NULL,
    entity_type VARCHAR NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Foreign Key & Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inquiries_seeker_id ON public.inquiries(seeker_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_advertiser_id ON public.inquiries(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON public.inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_created ON public.inquiry_messages(inquiry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_property_reports_property_status ON public.property_reports(property_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 4. Properties & Property Images Hardened Policies
DROP POLICY IF EXISTS "Advertisers and Admins can update properties" ON public.properties;
CREATE POLICY "Advertisers and Admins can update properties"
ON public.properties FOR UPDATE
TO authenticated
USING (
    advertiser_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
    )
)
WITH CHECK (
    advertiser_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
    )
);

DROP POLICY IF EXISTS "Advertisers and Admins can delete properties" ON public.properties;
CREATE POLICY "Advertisers and Admins can delete properties"
ON public.properties FOR DELETE
TO authenticated
USING (
    (advertiser_id = (SELECT auth.uid()) AND status::text <> 'published')
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
    )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_images') THEN
        ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Uploader or Admin can delete property images" ON public.property_images;
        CREATE POLICY "Uploader or Admin can delete property images"
        ON public.property_images FOR DELETE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.properties p
                WHERE p.id = property_images.property_id
                  AND p.advertiser_id = (SELECT auth.uid())
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = (SELECT auth.uid())
                  AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
            )
        );
    END IF;
END $$;

-- 5. Inquiries & Private Chat Supervision Policies
DROP POLICY IF EXISTS "Inquiry Participants and Admins Access" ON public.inquiries;
CREATE POLICY "Inquiry Participants and Admins Access"
ON public.inquiries FOR ALL
TO authenticated
USING (
    seeker_id = (SELECT auth.uid())
    OR advertiser_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator', 'support')
    )
)
WITH CHECK (
    seeker_id = (SELECT auth.uid())
    OR advertiser_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator', 'support')
    )
);

DROP POLICY IF EXISTS "Inquiry Messages Participants and Admins Read" ON public.inquiry_messages;
CREATE POLICY "Inquiry Messages Participants and Admins Read"
ON public.inquiry_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.inquiries i
        WHERE i.id = inquiry_messages.inquiry_id
          AND (
              i.seeker_id = (SELECT auth.uid())
              OR i.advertiser_id = (SELECT auth.uid())
              OR EXISTS (
                  SELECT 1 FROM public.profiles
                  WHERE profiles.id = (SELECT auth.uid())
                    AND profiles.role::text IN ('admin', 'superadmin', 'moderator', 'support')
              )
          )
    )
);

DROP POLICY IF EXISTS "Inquiry Messages Verified Sender Insert" ON public.inquiry_messages;
CREATE POLICY "Inquiry Messages Verified Sender Insert"
ON public.inquiry_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
        is_admin_note = false
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role::text IN ('admin', 'superadmin', 'moderator', 'support')
        )
    )
);

-- 6. Property Reports & Audit Events Policies
DROP POLICY IF EXISTS "Admins can view and manage property reports" ON public.property_reports;
CREATE POLICY "Admins can view and manage property reports"
ON public.property_reports FOR ALL
TO authenticated
USING (
    reporter_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator', 'support')
    )
);

DROP POLICY IF EXISTS "Admins can read audit events" ON public.audit_events;
CREATE POLICY "Admins can read audit events"
ON public.audit_events FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
);

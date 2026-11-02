CREATE TABLE IF NOT EXISTS public.cms_settings (
    key VARCHAR PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cms_settings" ON public.cms_settings;
CREATE POLICY "Public read cms_settings"
ON public.cms_settings FOR SELECT
TO anon, authenticated
USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.cms_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cms_settings TO service_role;

NOTIFY pgrst, 'reload schema';
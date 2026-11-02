-- Migration: Add is_read column to inquiry_messages safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inquiry_messages') THEN
        ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_read ON public.inquiry_messages(inquiry_id, is_read);
    END IF;
END $$;

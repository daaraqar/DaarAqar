-- Migration: Add project_details column to properties table if not present
-- Enables storing flexible project metadata, developer info, and installment plans as JSONB

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'properties'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'project_details'
        ) THEN
            ALTER TABLE public.properties ADD COLUMN project_details JSONB;
        END IF;
    END IF;
END $$;

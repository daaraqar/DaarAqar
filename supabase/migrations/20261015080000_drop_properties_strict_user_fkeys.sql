-- Migration: Drop strict foreign key constraints on owner_id, advertiser_id, and user_id in properties
-- Allows flexible user listing for internal sessions, OTP users, and Supabase auth accounts alike.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'properties_owner_id_fkey' AND table_name = 'properties'
    ) THEN
        ALTER TABLE public.properties DROP CONSTRAINT properties_owner_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'properties_advertiser_id_fkey' AND table_name = 'properties'
    ) THEN
        ALTER TABLE public.properties DROP CONSTRAINT properties_advertiser_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'properties_user_id_fkey' AND table_name = 'properties'
    ) THEN
        ALTER TABLE public.properties DROP CONSTRAINT properties_user_id_fkey;
    END IF;
END $$;

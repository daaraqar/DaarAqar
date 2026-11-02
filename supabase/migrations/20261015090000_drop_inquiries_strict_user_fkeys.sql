-- Migration: Drop strict foreign key constraints on inquiries and inquiry_messages
-- to allow flexible inquiries across internal sessions, OTP users, and Supabase auth accounts.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'inquiries_advertiser_id_fkey' AND table_name = 'inquiries'
    ) THEN
        ALTER TABLE public.inquiries DROP CONSTRAINT inquiries_advertiser_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'inquiries_seeker_id_fkey' AND table_name = 'inquiries'
    ) THEN
        ALTER TABLE public.inquiries DROP CONSTRAINT inquiries_seeker_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'inquiry_messages_sender_id_fkey' AND table_name = 'inquiry_messages'
    ) THEN
        ALTER TABLE public.inquiry_messages DROP CONSTRAINT inquiry_messages_sender_id_fkey;
    END IF;
END $$;

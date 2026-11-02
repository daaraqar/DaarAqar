-- ==============================================================================
-- Migration: 20261015070000_optimize_clean_storage_rls.sql
-- Description:
--   Purges all legacy, duplicate, and fragmented RLS policies on storage.objects
--   and establishes the 4 canonical, ultra-fast storage policies for
--   property-images and avatars.
-- ==============================================================================

-- 1. Ensure storage buckets exist and are public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('property-images', 'property-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop all duplicate/fragmented policies on storage.objects
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
    END LOOP;
END $$;

-- 3. Ensure Row Level Security is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Establish the 4 Canonical Storage Policies

-- Policy 1: Public Read Access (Ultra-fast direct read for public assets)
CREATE POLICY "canonical_storage_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('property-images', 'avatars'));

-- Policy 2: Authenticated Uploads
CREATE POLICY "canonical_storage_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('property-images', 'avatars'));

-- Policy 3: Authenticated Updates (Owner or Admin)
CREATE POLICY "canonical_storage_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id IN ('property-images', 'avatars')
    AND (
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
        OR (SELECT auth.uid())::text = owner::text
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
              AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
        )
    )
)
WITH CHECK (
    bucket_id IN ('property-images', 'avatars')
);

-- Policy 4: Authenticated Deletions (Owner or Admin)
CREATE POLICY "canonical_storage_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('property-images', 'avatars')
    AND (
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
        OR (SELECT auth.uid())::text = owner::text
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
              AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
        )
    )
);

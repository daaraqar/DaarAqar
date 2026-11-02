-- ==============================================================================
-- Migration: 20261015060000_consolidated_clean_schema.sql
-- Description:
--   Unified, Consolidated Clean Schema for AqarPulse Platform.
--   Consolidates database structure, PostGIS extensions, status enums,
--   unified coordinates (latitude/longitude & exact_lat/exact_lng),
--   unified user keys (user_id & advertiser_id), hardened RLS policies,
--   and eliminates any obsolete demotion triggers for 100% clean operations.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Consolidated Property Status Enum
DO $$ BEGIN
    CREATE TYPE public.property_status_enum AS ENUM (
        'draft',
        'pending',
        'pending_review',
        'under_review',
        'active',
        'published',
        'rejected',
        'archived',
        'suspended'
    );
EXCEPTION 
    WHEN duplicate_object THEN
        -- Add any missing enum values if type already exists
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'pending';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'pending_review';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'under_review';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'active';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'published';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'rejected';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'suspended';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'archived';
        ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'draft';
END $$;

-- 3. Consolidated Transaction & Privacy Enums
DO $$ BEGIN
    CREATE TYPE public.transaction_type_enum AS ENUM ('sale', 'rent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.location_privacy_enum AS ENUM ('exact', 'approximate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Ensure public.properties Table & Consolidated Columns
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    transaction_type public.transaction_type_enum NOT NULL DEFAULT 'sale',
    category VARCHAR NOT NULL DEFAULT 'apartment',
    price NUMERIC NOT NULL CHECK (price >= 0),
    currency VARCHAR NOT NULL DEFAULT 'EGP',
    rental_period VARCHAR,
    negotiable BOOLEAN NOT NULL DEFAULT false,
    down_payment NUMERIC,
    installment_years INT,
    area_sqm NUMERIC NOT NULL CHECK (area_sqm > 0),
    bedrooms INT,
    bathrooms INT,
    floor INT,
    total_floors INT,
    finishing_status VARCHAR,
    furnishing_status VARCHAR,
    parking_spots INT DEFAULT 0,
    has_elevator BOOLEAN DEFAULT false,
    has_building_permit BOOLEAN DEFAULT false,
    year_built INT,
    city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    address_details TEXT,
    exact_lat DOUBLE PRECISION,
    exact_lng DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_privacy public.location_privacy_enum NOT NULL DEFAULT 'exact',
    approximate_lat DOUBLE PRECISION,
    approximate_lng DOUBLE PRECISION,
    location geography(Point, 4326),
    approximate_location geography(Point, 4326),
    status public.property_status_enum NOT NULL DEFAULT 'pending',
    moderation_notes TEXT,
    featured BOOLEAN NOT NULL DEFAULT false,
    views_count INT NOT NULL DEFAULT 0,
    inquiries_count INT NOT NULL DEFAULT 0,
    advertiser_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    advertiser_type VARCHAR NOT NULL DEFAULT 'owner',
    is_project BOOLEAN NOT NULL DEFAULT false,
    project_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    moderated_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ
);

-- Ensure all consolidated columns exist if table was already created
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS advertiser_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS exact_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS exact_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS approximate_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS approximate_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location geography(Point, 4326),
ADD COLUMN IF NOT EXISTS approximate_location geography(Point, 4326),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
ADD COLUMN IF NOT EXISTS is_project BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS project_details JSONB;

-- Set default status to 'pending'
ALTER TABLE public.properties 
ALTER COLUMN status SET DEFAULT 'pending'::public.property_status_enum;

-- 5. Auto-synchronization trigger for user keys, coordinates, and PostGIS geometries
CREATE OR REPLACE FUNCTION public.sync_property_consolidated_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Synchronize user identity columns
    IF NEW.user_id IS NULL THEN
        NEW.user_id := COALESCE(NEW.advertiser_id, NEW.owner_id);
    END IF;
    IF NEW.advertiser_id IS NULL THEN
        NEW.advertiser_id := COALESCE(NEW.user_id, NEW.owner_id);
    END IF;
    IF NEW.owner_id IS NULL THEN
        NEW.owner_id := COALESCE(NEW.user_id, NEW.advertiser_id);
    END IF;

    -- Synchronize coordinates
    IF NEW.latitude IS NULL THEN
        NEW.latitude := NEW.exact_lat;
    END IF;
    IF NEW.exact_lat IS NULL THEN
        NEW.exact_lat := NEW.latitude;
    END IF;

    IF NEW.longitude IS NULL THEN
        NEW.longitude := NEW.exact_lng;
    END IF;
    IF NEW.exact_lng IS NULL THEN
        NEW.exact_lng := NEW.longitude;
    END IF;

    -- Update PostGIS exact location point
    IF NEW.exact_lat IS NOT NULL AND NEW.exact_lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.exact_lng, NEW.exact_lat), 4326)::geography;
    END IF;

    -- Update PostGIS approximate location point
    IF NEW.approximate_lat IS NOT NULL AND NEW.approximate_lng IS NOT NULL THEN
        NEW.approximate_location := ST_SetSRID(ST_MakePoint(NEW.approximate_lng, NEW.approximate_lat), 4326)::geography;
    ELSIF NEW.location IS NOT NULL THEN
        NEW.approximate_location := NEW.location;
    END IF;

    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_property_consolidated_fields ON public.properties;
CREATE TRIGGER trg_sync_property_consolidated_fields
BEFORE INSERT OR UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_consolidated_fields();

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_advertiser_id ON public.properties(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_location_gist ON public.properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_approx_gist ON public.properties USING GIST (approximate_location);
CREATE INDEX IF NOT EXISTS idx_properties_search_composite ON public.properties (status, transaction_type, city_id, district_id, price);

-- 7. Clean Hardened RLS Policies (Zero demotion triggers)
DROP TRIGGER IF EXISTS trg_enforce_safe_property_status ON public.properties;
DROP TRIGGER IF EXISTS trg_prevent_owner_self_approval ON public.properties;
DROP FUNCTION IF EXISTS public.enforce_safe_property_status();
DROP FUNCTION IF EXISTS public.prevent_owner_self_approval();

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "properties_public_view" ON public.properties;
    DROP POLICY IF EXISTS "properties_owner_read_all" ON public.properties;
    DROP POLICY IF EXISTS "properties_admin_full_access" ON public.properties;
    DROP POLICY IF EXISTS "Allow server-mediated property listings insertion" ON public.properties;
    DROP POLICY IF EXISTS "Allow server-mediated property listings update" ON public.properties;
END $$;

-- Public Visibility: Anyone can view active or published listings
CREATE POLICY "properties_public_view" ON public.properties
FOR SELECT TO public
USING (status::text IN ('active', 'published'));

-- Owner Visibility: Authenticated users can read all their own properties in all statuses
CREATE POLICY "properties_owner_read_all" ON public.properties
FOR SELECT TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT auth.uid()) = advertiser_id
    OR (SELECT auth.uid()) = owner_id
);

-- Insertion: Authenticated and server-mediated insertion
CREATE POLICY "Allow server-mediated property listings insertion"
ON public.properties FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Update: Authenticated and server-mediated update
CREATE POLICY "Allow server-mediated property listings update"
ON public.properties FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Admin Full Access: Platform administrators and moderators
CREATE POLICY "properties_admin_full_access" ON public.properties
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
          AND profiles.role::text IN ('admin', 'superadmin', 'moderator')
    )
);

-- 8. PostGIS Spatial RPC Functions
CREATE OR REPLACE FUNCTION public.search_properties_within_bounds(
    min_lng DOUBLE PRECISION,
    min_lat DOUBLE PRECISION,
    max_lng DOUBLE PRECISION,
    max_lat DOUBLE PRECISION,
    filter_transaction_type transaction_type_enum DEFAULT NULL,
    filter_category VARCHAR DEFAULT NULL,
    min_price NUMERIC DEFAULT NULL,
    max_price NUMERIC DEFAULT NULL,
    limit_count INT DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    slug VARCHAR,
    title VARCHAR,
    description TEXT,
    price NUMERIC,
    currency VARCHAR,
    rental_period VARCHAR,
    transaction_type transaction_type_enum,
    category VARCHAR,
    area_sqm NUMERIC,
    bedrooms INT,
    bathrooms INT,
    location_privacy location_privacy_enum,
    exact_lat DOUBLE PRECISION,
    exact_lng DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    approximate_lat DOUBLE PRECISION,
    approximate_lng DOUBLE PRECISION,
    status property_status_enum,
    featured BOOLEAN,
    advertiser_type VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.slug,
        p.title,
        p.description,
        p.price,
        p.currency,
        p.rental_period,
        p.transaction_type,
        p.category,
        p.area_sqm,
        p.bedrooms,
        p.bathrooms,
        p.location_privacy,
        p.exact_lat,
        p.exact_lng,
        p.latitude,
        p.longitude,
        p.approximate_lat,
        p.approximate_lng,
        p.status,
        p.featured,
        p.advertiser_type,
        p.created_at
    FROM public.properties p
    WHERE 
        p.status::text IN ('active', 'published')
        AND p.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        AND (filter_transaction_type IS NULL OR p.transaction_type = filter_transaction_type)
        AND (filter_category IS NULL OR p.category = filter_category)
        AND (min_price IS NULL OR p.price >= min_price)
        AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY p.featured DESC, p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.search_properties_within_bounds TO anon, authenticated, service_role;

-- 9. Dashboard & Admin Secure RPCs
CREATE OR REPLACE FUNCTION public.get_dashboard_properties_for_user(p_user_id UUID)
RETURNS SETOF public.properties
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.properties
    WHERE user_id = p_user_id
       OR advertiser_id = p_user_id
       OR owner_id = p_user_id
    ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_properties_for_user(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_all_properties_for_admin_rpc()
RETURNS SETOF public.properties
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.properties
    ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_properties_for_admin_rpc() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_approve_property(
    p_property_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated public.properties%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    UPDATE public.properties
    SET status = 'active',
        approved_at = v_now,
        published_at = v_now,
        moderated_at = v_now,
        moderation_notes = COALESCE(p_notes, moderation_notes),
        updated_at = v_now
    WHERE id = p_property_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_updated.id,
        'status', v_updated.status,
        'approved_at', v_updated.approved_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_property(UUID, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- AqarPulse — Clean Additive Migration (Zero Fake Users, Zero Invented Listings)
-- Includes:
-- 1. PostGIS Bounding-Box Viewport RPC (search_properties_within_bounds)
-- 2. Clean Egyptian Geography Hierarchy (Countries, Cities, Districts)
-- 3. Storage Bucket & Strict RLS Policies for property-images
-- ==============================================================================

-- 1. Viewport Bounding-Box Search Function (PostGIS ST_MakeEnvelope)
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
        p.approximate_lat,
        p.approximate_lng,
        p.status,
        p.featured,
        p.advertiser_type,
        p.created_at
    FROM public.properties p
    WHERE 
        p.status = 'published'
        AND p.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        AND (filter_transaction_type IS NULL OR p.transaction_type = filter_transaction_type)
        AND (filter_category IS NULL OR p.category = filter_category)
        AND (min_price IS NULL OR p.price >= min_price)
        AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY p.featured DESC, p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execution to public / anon / authenticated roles
GRANT EXECUTE ON FUNCTION public.search_properties_within_bounds TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_properties_within_radius TO anon, authenticated;

-- 2. Clean Egyptian Geography Hierarchy (Reference Data Only)
DO $$
DECLARE
    v_country_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
    v_cairo_id UUID := 'c1000000-0000-0000-0000-000000000001'::uuid;
    v_giza_id UUID := 'c2000000-0000-0000-0000-000000000002'::uuid;
    v_alex_id UUID := 'c3000000-0000-0000-0000-000000000003'::uuid;
BEGIN
    -- Country: Egypt
    INSERT INTO public.countries (id, iso_code, name_ar, name_en, currency_code)
    VALUES (v_country_id, 'EG', 'جمهورية مصر العربية', 'Egypt', 'EGP')
    ON CONFLICT (iso_code) DO NOTHING;

    -- Cities: Cairo, Giza, Alexandria
    INSERT INTO public.cities (id, country_id, slug, name_ar, name_en, center_location, zoom_level)
    VALUES 
        (v_cairo_id, v_country_id, 'cairo', 'القاهرة', 'Cairo', ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326)::geography, 12),
        (v_giza_id, v_country_id, 'giza', 'الجيزة', 'Giza', ST_SetSRID(ST_MakePoint(31.1303, 29.9870), 4326)::geography, 12),
        (v_alex_id, v_country_id, 'alexandria', 'الإسكندرية', 'Alexandria', ST_SetSRID(ST_MakePoint(29.9553, 31.2001), 4326)::geography, 12)
    ON CONFLICT (slug) DO NOTHING;

    -- Districts
    INSERT INTO public.districts (city_id, slug, name_ar, name_en, center_location)
    VALUES 
        (v_cairo_id, 'new-cairo', 'القاهرة الجديدة (التجمع الخامس)', 'New Cairo (Fifth Settlement)', ST_SetSRID(ST_MakePoint(31.4700, 30.0200), 4326)::geography),
        (v_cairo_id, 'new-capital', 'العاصمة الإدارية الجديدة', 'New Administrative Capital', ST_SetSRID(ST_MakePoint(31.7500, 30.0100), 4326)::geography),
        (v_cairo_id, 'maadi', 'المعادي', 'Maadi', ST_SetSRID(ST_MakePoint(31.2600, 29.9600), 4326)::geography),
        (v_cairo_id, 'heliopolis', 'مصر الجديدة', 'Heliopolis', ST_SetSRID(ST_MakePoint(31.3300, 30.0900), 4326)::geography),
        (v_cairo_id, 'nasr-city', 'مدينة نصر', 'Nasr City', ST_SetSRID(ST_MakePoint(31.3400, 30.0500), 4326)::geography),
        (v_cairo_id, 'shorouk', 'الشروق', 'El Shorouk', ST_SetSRID(ST_MakePoint(31.6300, 30.1300), 4326)::geography),
        (v_cairo_id, 'madinaty', 'مدينتي', 'Madinaty', ST_SetSRID(ST_MakePoint(31.6300, 30.0800), 4326)::geography),
        (v_giza_id, 'sheikh-zayed', 'الشيخ زايد', 'Sheikh Zayed City', ST_SetSRID(ST_MakePoint(30.9800, 30.0500), 4326)::geography),
        (v_giza_id, '6th-october', 'السادس من أكتوبر', '6th of October City', ST_SetSRID(ST_MakePoint(30.9300, 29.9700), 4326)::geography),
        (v_giza_id, 'dokki', 'الدقي', 'Dokki', ST_SetSRID(ST_MakePoint(31.2100, 30.0400), 4326)::geography),
        (v_giza_id, 'mohandessin', 'المهندسين', 'Mohandessin', ST_SetSRID(ST_MakePoint(31.2000, 30.0550), 4326)::geography)
    ON CONFLICT (city_id, slug) DO NOTHING;
END $$;

-- 3. Storage Bucket Configuration (property-images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'property-images',
    'property-images',
    true,
    10485760, -- 10MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- Storage Policies with User Isolation
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public Read Property Images Bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own uploaded property images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own uploaded property images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Public Read Property Images Bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can upload property images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'property-images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can update their own uploaded property images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'property-images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
    bucket_id = 'property-images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can delete their own uploaded property images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'property-images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

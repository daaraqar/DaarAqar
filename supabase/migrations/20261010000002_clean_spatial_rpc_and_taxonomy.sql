-- ==============================================================================
-- AqarPulse — Clean Additive Migration 
-- ==============================================================================

-- 1. إسقاط الدالة القديمة نهائياً وبشكل قسري لتجنب أي تعارض في المخرجات أو الأنواع
DROP FUNCTION IF EXISTS public.search_properties_within_bounds CASCADE;

-- 2. إنشاء الدالة بالهيكل المطلوب والمحدث
CREATE FUNCTION public.search_properties_within_bounds(
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

-- 3. منح الصلاحيات بدقة
GRANT EXECUTE ON FUNCTION public.search_properties_within_bounds(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, transaction_type_enum, VARCHAR, NUMERIC, NUMERIC, INT) TO anon, authenticated;

-- 4. مرجع الجغرافيا والبيانات الأساسية لمصر
DO $$
DECLARE
    v_country_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
    v_cairo_id UUID := 'c1000000-0000-0000-0000-000000000001'::uuid;
    v_giza_id UUID := 'c2000000-0000-0000-0000-000000000002'::uuid;
    v_alex_id UUID := 'c3000000-0000-0000-0000-000000000003'::uuid;
BEGIN
    INSERT INTO public.countries (id, iso_code, name_ar, name_en, currency_code)
    VALUES (v_country_id, 'EG', 'جمهورية مصر العربية', 'Egypt', 'EGP')
    ON CONFLICT (iso_code) DO NOTHING;

    INSERT INTO public.cities (id, country_id, slug, name_ar, name_en, center_location, zoom_level)
    VALUES 
        (v_cairo_id, v_country_id, 'cairo', 'القاهرة', 'Cairo', ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326)::geography, 12),
        (v_giza_id, v_country_id, 'giza', 'الجيزة', 'Giza', ST_SetSRID(ST_MakePoint(31.1303, 29.9870), 4326)::geography, 12),
        (v_alex_id, v_country_id, 'alexandria', 'الإسكندرية', 'Alexandria', ST_SetSRID(ST_MakePoint(29.9553, 31.2001), 4326)::geography, 12)
    ON CONFLICT (slug) DO NOTHING;
END $$;

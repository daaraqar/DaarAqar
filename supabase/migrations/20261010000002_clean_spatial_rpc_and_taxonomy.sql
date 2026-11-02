-- 0. Force drop any existing version of the function (Cascade clears dependency locks & return-type mismatch)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname = 'search_properties_within_bounds'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END $$;

-- 1. Create the function with the exact updated return signature
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

-- 2. Grant execution permissions safely
GRANT EXECUTE ON FUNCTION public.search_properties_within_bounds(
    DOUBLE PRECISION, 
    DOUBLE PRECISION, 
    DOUBLE PRECISION, 
    DOUBLE PRECISION, 
    transaction_type_enum, 
    VARCHAR, 
    NUMERIC, 
    NUMERIC, 
    INT
) TO anon, authenticated;

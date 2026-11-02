CREATE TABLE IF NOT EXISTS public.crm_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('client', 'broker')),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL CHECK (phone_normalized ~ '^\+201[0125][0-9]{8}$'),
  requested_property TEXT,
  requested_category TEXT,
  requested_area NUMERIC,
  requested_price_range TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  transaction_type TEXT CHECK (transaction_type IS NULL OR transaction_type IN ('sale', 'rent')),
  requested_location TEXT,
  available_listings TEXT,
  listings_count INTEGER,
  notes TEXT,
  source_type TEXT CHECK (source_type IS NULL OR source_type IN ('manual', 'bot', 'link', 'import')),
  source_url TEXT,
  embedding JSONB,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_records_type_updated_idx
  ON public.crm_records (type, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_records_phone_normalized_idx
  ON public.crm_records (phone_normalized);

ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_records TO service_role;

CREATE OR REPLACE FUNCTION public.crm_import_records(p_records JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_record JSONB;
  v_name TEXT;
  v_phone TEXT;
  v_phone_normalized TEXT;
  v_existing RECORD;
  v_inserted INTEGER := 0;
  v_duplicates JSONB := '[]'::JSONB;
  v_row_number INTEGER := 0;
BEGIN
  IF p_records IS NULL
    OR jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'CRM import must contain between 1 and 500 rows';
  END IF;
  IF jsonb_array_length(p_records) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'CRM import must contain between 1 and 500 rows';
  END IF;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    v_row_number := v_row_number + 1;
    v_name := btrim(COALESCE(v_record ->> 'name', ''));
    v_phone := btrim(COALESCE(v_record ->> 'phone', ''));
    v_phone_normalized := btrim(COALESCE(v_record ->> 'phoneNormalized', ''));

    IF char_length(v_name) NOT BETWEEN 2 AND 120
      OR v_phone_normalized !~ '^\+201[0125][0-9]{8}$' THEN
      RAISE EXCEPTION 'Invalid CRM import row %', v_row_number;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(v_phone_normalized));

    SELECT id, name
      INTO v_existing
      FROM public.crm_records
      WHERE phone_normalized = v_phone_normalized
      LIMIT 1;

    IF FOUND THEN
      v_duplicates := v_duplicates || jsonb_build_array(jsonb_build_object(
        'rowNumber', COALESCE((v_record ->> 'rowNumber')::INTEGER, v_row_number),
        'name', v_name,
        'phone', v_phone,
        'existingName', v_existing.name,
        'existingId', v_existing.id
      ));
      CONTINUE;
    END IF;

    INSERT INTO public.crm_records (
      type, name, phone, phone_normalized, requested_property, requested_category,
      requested_area, requested_price_range, price_min, price_max, transaction_type,
      requested_location, available_listings, listings_count, notes, source_type,
      source_url, is_verified, created_by
    )
    VALUES (
      v_record ->> 'type',
      v_name,
      v_phone,
      v_phone_normalized,
      NULLIF(v_record ->> 'requestedProperty', ''),
      NULLIF(v_record ->> 'requestedCategory', ''),
      NULLIF(v_record ->> 'requestedArea', '')::NUMERIC,
      NULLIF(v_record ->> 'requestedPriceRange', ''),
      NULLIF(v_record ->> 'priceMin', '')::NUMERIC,
      NULLIF(v_record ->> 'priceMax', '')::NUMERIC,
      NULLIF(v_record ->> 'transactionType', ''),
      NULLIF(v_record ->> 'requestedLocation', ''),
      NULLIF(v_record ->> 'availableListings', ''),
      NULLIF(v_record ->> 'listingsCount', '')::INTEGER,
      NULLIF(v_record ->> 'notes', ''),
      'import',
      NULLIF(v_record ->> 'sourceUrl', ''),
      FALSE,
      NULLIF(v_record ->> 'createdBy', '')
    )
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'duplicates', v_duplicates);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_import_records(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_import_records(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_create_ai_record(p_record JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_phone_normalized TEXT := btrim(COALESCE(p_record ->> 'phoneNormalized', ''));
  v_existing public.crm_records%ROWTYPE;
  v_created public.crm_records%ROWTYPE;
  v_source_type TEXT := COALESCE(p_record ->> 'sourceType', 'bot');
BEGIN
  IF v_phone_normalized !~ '^\+201[0125][0-9]{8}$'
    OR char_length(btrim(COALESCE(p_record ->> 'name', ''))) NOT BETWEEN 2 AND 120
    OR v_source_type NOT IN ('bot', 'link') THEN
    RAISE EXCEPTION 'Invalid CRM AI record';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_phone_normalized));

  SELECT *
    INTO v_existing
    FROM public.crm_records
    WHERE phone_normalized = v_phone_normalized
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'phone', v_existing.phone)
    );
  END IF;

  INSERT INTO public.crm_records (
    type, name, phone, phone_normalized, requested_property, requested_category,
    requested_area, requested_price_range, price_min, price_max, transaction_type,
    requested_location, available_listings, listings_count, notes, source_type,
    source_url, is_verified, created_by
  )
  VALUES (
    p_record ->> 'type',
    btrim(p_record ->> 'name'),
    btrim(p_record ->> 'phone'),
    v_phone_normalized,
    NULLIF(p_record ->> 'requestedProperty', ''),
    NULLIF(p_record ->> 'requestedCategory', ''),
    NULLIF(p_record ->> 'requestedArea', '')::NUMERIC,
    NULLIF(p_record ->> 'requestedPriceRange', ''),
    NULLIF(p_record ->> 'priceMin', '')::NUMERIC,
    NULLIF(p_record ->> 'priceMax', '')::NUMERIC,
    NULLIF(p_record ->> 'transactionType', ''),
    NULLIF(p_record ->> 'requestedLocation', ''),
    NULLIF(p_record ->> 'availableListings', ''),
    NULLIF(p_record ->> 'listingsCount', '')::INTEGER,
    NULLIF(p_record ->> 'notes', ''),
    v_source_type,
    NULLIF(p_record ->> 'sourceUrl', ''),
    FALSE,
    NULLIF(p_record ->> 'createdBy', '')
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object('record', to_jsonb(v_created));
END;
$$;

REVOKE ALL ON FUNCTION public.crm_create_ai_record(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_create_ai_record(JSONB) TO service_role;
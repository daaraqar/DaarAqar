ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS property_title TEXT;

UPDATE public.inquiries AS inquiry
SET property_title = property.title
FROM public.properties AS property
WHERE inquiry.property_id = property.id
  AND (inquiry.property_title IS NULL OR btrim(inquiry.property_title) = '');

ALTER TABLE public.inquiries
  ALTER COLUMN property_id DROP NOT NULL;

DO $$
DECLARE
  property_id_attnum SMALLINT;
  foreign_key_name TEXT;
BEGIN
  SELECT attnum
  INTO property_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.inquiries'::regclass
    AND attname = 'property_id'
    AND NOT attisdropped;

  FOR foreign_key_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass
      AND confrelid = 'public.properties'::regclass
      AND contype = 'f'
      AND conkey @> ARRAY[property_id_attnum]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.inquiries DROP CONSTRAINT %I',
      foreign_key_name
    );
  END LOOP;
END
$$;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_property_id_fkey
  FOREIGN KEY (property_id)
  REFERENCES public.properties(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_property_id
  ON public.inquiries(property_id);
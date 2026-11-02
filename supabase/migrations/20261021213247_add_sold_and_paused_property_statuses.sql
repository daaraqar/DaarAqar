ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE public.property_status_enum ADD VALUE IF NOT EXISTS 'rented';
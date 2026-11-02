-- ==============================================================================
-- Migration: 20261015040000_production_clean_slate_reset.sql
-- Status: NEUTRALIZED (SAFE NO-OP)
-- Description:
--   Originally contained destructive DELETE statements across transactional and
--   user tables. Replaced with a non-destructive no-op to strictly protect
--   production data while preserving the 20261015040000 migration version
--   in supabase_migrations.schema_migrations.
--   Zero rows are deleted or modified by this migration.
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Skipping destructive reset in 20261015040000_production_clean_slate_reset.sql to protect production data.';
END $$;

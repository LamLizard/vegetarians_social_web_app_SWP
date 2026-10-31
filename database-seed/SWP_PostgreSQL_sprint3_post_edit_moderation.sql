-- Manual, operator-reviewed artifact. Do not execute from the application.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.post
  ADD COLUMN IF NOT EXISTS edit_moderation jsonb,
  ADD COLUMN IF NOT EXISTS edit_request_id uuid,
  ADD COLUMN IF NOT EXISTS edit_request_fingerprint character(64);

DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('edit_moderation', 'jsonb'),
    ('edit_request_id', 'uuid'),
    ('edit_request_fingerprint', 'character(64)')
  ) AS wanted(name, sql_type)
  LOOP
    SELECT format_type(a.atttypid, a.atttypmod) AS sql_type,
      a.attnotnull, a.atthasdef, a.attgenerated, a.attidentity
    INTO actual
    FROM pg_attribute a
    WHERE a.attrelid = 'public.post'::regclass AND a.attname = expected.name
      AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND OR actual.sql_type <> expected.sql_type OR actual.attnotnull OR actual.atthasdef
       OR actual.attgenerated <> '' OR actual.attidentity <> '' THEN
      RAISE EXCEPTION 'Incompatible post column: %', expected.name;
    END IF;
  END LOOP;
END $$;
COMMIT;

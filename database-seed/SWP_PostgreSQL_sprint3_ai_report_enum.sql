-- Operator-reviewed artifact only: commit this separately before the feature artifact.
-- Fail if the enum is missing or its baseline is different from the reviewed schema.
BEGIN;
DO $$
DECLARE labels TEXT[];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO labels
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = 'public' AND t.typname = 'report_status_enum';
  IF labels IS DISTINCT FROM ARRAY['pending', 'accepted', 'rejected']::text[] THEN
    RAISE EXCEPTION 'Unknown report_status_enum; review live schema before applying';
  END IF;
  ALTER TYPE public.report_status_enum ADD VALUE 'auto_closed_deleted';
END $$;
COMMIT;

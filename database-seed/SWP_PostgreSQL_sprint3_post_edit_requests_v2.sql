-- Operator-reviewed migration. Review this file before applying it to a database.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.post_edit_requests
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'edited';
UPDATE public.post_edit_requests SET status = 'edited' WHERE status IS DISTINCT FROM 'edited';
ALTER TABLE public.post_edit_requests
  ADD COLUMN IF NOT EXISTS request_id UUID;

DO $$
BEGIN
  IF to_regclass('public.post_edit_request_receipts') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.post_edit_requests er
      SET request_id = rr.request_id
      FROM public.post_edit_request_receipts rr
      WHERE rr.post_edit_request_id = er.post_edit_request_id
        AND er.request_id IS NULL
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM public.post_edit_requests WHERE request_id IS NULL) THEN
    RAISE EXCEPTION 'post_edit_requests contains rows without request_id; resolve them before migration';
  END IF;
END $$;

ALTER TABLE public.post_edit_requests ALTER COLUMN request_id SET NOT NULL;
DROP TABLE IF EXISTS public.post_edit_request_receipts;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.post_edit_requests'::regclass
      AND conname = 'post_edit_requests_status_edited_check'
  ) THEN
    ALTER TABLE public.post_edit_requests
      ADD CONSTRAINT post_edit_requests_status_edited_check CHECK (status = 'edited');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.post_edit_requests'::regclass
      AND conname = 'post_edit_requests_account_request_id_key'
  ) THEN
    ALTER TABLE public.post_edit_requests
      ADD CONSTRAINT post_edit_requests_account_request_id_key UNIQUE (account_id, request_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_edit_requests_edited_queue_idx
  ON public.post_edit_requests (submitted_at, post_edit_request_id)
  WHERE status = 'edited';

COMMIT;

-- Operator-reviewed artifact only. Do not run from the application.
-- The separate report enum artifact must be committed first before using its new value.
-- Fails on existing table names rather than accepting an unknown live schema.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'report_status_enum'
      AND e.enumlabel = 'auto_closed_deleted'
  ) THEN
    RAISE EXCEPTION 'Apply and review the separate report enum artifact first';
  END IF;
END $$;

CREATE TABLE public.ai_configuration (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  comment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  comment_provider VARCHAR(16) NOT NULL DEFAULT 'openai' CHECK (comment_provider IN ('openai', 'groq')),
  post_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  post_provider VARCHAR(16) NOT NULL DEFAULT 'openai' CHECK (post_provider IN ('openai', 'groq')),
  chatbot_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES public.account(account_id)
);

INSERT INTO public.ai_configuration (id) VALUES (1);

-- Actor IDs are retained without cascade; lifecycle/FK policy requires operator review.
CREATE TABLE public.comment_delete_audit (
  comment_id BIGINT PRIMARY KEY,
  actor_id BIGINT NOT NULL,
  actor_role VARCHAR(16) NOT NULL CHECK (actor_role IN ('member', 'admin')),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

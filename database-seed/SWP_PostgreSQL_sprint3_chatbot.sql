-- Prepared for manual execution by the user. Run the entire script as one transaction.
-- Creates only public.chatbot_request and indexes on that new table.
-- Existing tables and their rows are not changed by this script.
-- If any name already exists, the transaction fails instead of accepting an unknown schema.
-- Runtime chatbot requests also use public.daily_quota; this script does not modify it.
-- Do not store conversation text, provider responses, API keys, or raw health data here.
BEGIN;
CREATE TABLE public.chatbot_request (
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('account', 'device')),
    subject_key VARCHAR(128) NOT NULL,
    operation_id UUID NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    quota_date DATE,
    state VARCHAR(16) NOT NULL CHECK (state IN ('pending', 'success', 'failed')),
    lease_id UUID NOT NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_type, subject_key, operation_id),
    CHECK ((subject_type = 'account' AND quota_date IS NOT NULL)
        OR (subject_type = 'device' AND quota_date IS NULL))
);

CREATE INDEX chatbot_request_active_quota_idx
    ON public.chatbot_request (subject_type, subject_key, quota_date, lease_expires_at)
    WHERE state = 'pending';

CREATE INDEX chatbot_request_completed_cleanup_idx
    ON public.chatbot_request (updated_at)
    WHERE state IN ('success', 'failed');

CREATE INDEX chatbot_request_pending_cleanup_idx
    ON public.chatbot_request (lease_expires_at)
    WHERE state = 'pending';

COMMIT;

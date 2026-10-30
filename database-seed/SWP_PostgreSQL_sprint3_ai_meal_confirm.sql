-- DRAFT ONLY. Do not execute without separate database authorization and
-- review of the live schema, locking, replay and retention contracts.
-- This metadata is inserted in the same transaction as the meal-plan writes.
-- A rolled-back write must not leave a record claiming success.
-- Do not store health information, raw profile data or meal content here.
BEGIN;

CREATE TABLE public.ai_meal_confirm_request (
    account_id BIGINT NOT NULL REFERENCES public.account (account_id),
    operation_id UUID NOT NULL,
    payload_hash VARCHAR(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    week_start DATE NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, operation_id)
);

-- Retention and cleanup are deliberately not specified by this draft.
-- Confirm remains unavailable until the table and the complete writer-lock
-- and replay contract have been reviewed and provisioned separately.
COMMIT;

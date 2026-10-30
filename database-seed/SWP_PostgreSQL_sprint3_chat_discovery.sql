-- DRAFT ONLY: do not execute until the live schema, quota writer, cleanup and
-- recovery contracts have been reviewed and separately authorized.
-- This artifact creates metadata only; it does not change existing tables.
-- Do not store chat text, search terms, provider output, post IDs or secrets.
-- BLOCKED: the operation table below is a draft, not a complete quota,
-- locking, fencing, expiry-proof, retention or recovery implementation.
-- Review these contracts and all shared writers before using this artifact.
BEGIN;

CREATE TABLE public.chatbot_discovery_flow (
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('account', 'device')),
    subject_key VARCHAR(128) NOT NULL,
    flow_id UUID NOT NULL,
    session_scope_hash VARCHAR(64) NOT NULL,
    subject_hash VARCHAR(64) NOT NULL,
    quota_date DATE,
    stage VARCHAR(24) NOT NULL CHECK (stage IN (
        'awaiting_choice', 'search_pending', 'found', 'empty', 'failed', 'cancelled', 'expired', 'uncertain'
    )),
    -- This is the server outcome, not proof that a guest browser updated localStorage.
    charge_intent BOOLEAN,
    lease_id UUID,
    lease_expires_at TIMESTAMPTZ,
    fence_version BIGINT NOT NULL DEFAULT 0 CHECK (fence_version >= 0),
    -- Set when the clarification is delivered, not when classification starts.
    choice_deadline TIMESTAMPTZ,
    flow_expires_at TIMESTAMPTZ NOT NULL,
    terminal_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_type, subject_key, flow_id),
    CHECK (subject_type = 'account'),
    CHECK ((subject_type = 'account' AND quota_date IS NOT NULL)
        OR (subject_type = 'device' AND quota_date IS NULL)),
    CHECK ((stage IN ('awaiting_choice', 'search_pending', 'uncertain') AND charge_intent IS NULL)
        OR (stage IN ('found', 'cancelled') AND charge_intent IS TRUE)
        OR (stage IN ('empty', 'failed', 'expired') AND charge_intent IS FALSE)),
    CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL)),
    CHECK ((stage IN ('found', 'empty', 'failed', 'cancelled', 'expired') AND terminal_at IS NOT NULL)
        OR (stage IN ('awaiting_choice', 'search_pending', 'uncertain') AND terminal_at IS NULL))
);

-- One record per operation permits clarification and choice to share a flow
-- without conflating their replay/status identities. A NULL flow is allowed for
-- an ordinary chat operation; device actors cannot attach a search flow.
CREATE TABLE public.chatbot_discovery_operation (
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('account', 'device')),
    subject_key VARCHAR(128) NOT NULL,
    operation_id UUID NOT NULL,
    flow_id UUID,
    payload_hash VARCHAR(64) NOT NULL,
    quota_date DATE,
    receipt_nonce UUID NOT NULL,
    state VARCHAR(24) NOT NULL CHECK (state IN (
        'prepared', 'pending', 'success', 'clarify', 'login_required', 'found', 'empty', 'failed', 'cancelled', 'expired'
    )),
    accept_until TIMESTAMPTZ NOT NULL,
    commit_by TIMESTAMPTZ NOT NULL,
    lease_id UUID,
    lease_expires_at TIMESTAMPTZ,
    fence_version BIGINT NOT NULL DEFAULT 0 CHECK (fence_version >= 0),
    terminal_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_type, subject_key, operation_id),
    FOREIGN KEY (subject_type, subject_key, flow_id)
        REFERENCES public.chatbot_discovery_flow (subject_type, subject_key, flow_id),
    CHECK (subject_type = 'account' OR flow_id IS NULL),
    CHECK ((subject_type = 'account' AND quota_date IS NOT NULL)
        OR (subject_type = 'device' AND quota_date IS NULL)),
    CHECK (accept_until <= commit_by),
    CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL)),
    CHECK ((state IN ('prepared', 'pending') AND terminal_at IS NULL)
        OR (state IN ('success', 'clarify', 'login_required', 'found', 'empty', 'failed', 'cancelled', 'expired') AND terminal_at IS NOT NULL))
);

-- Uncertain flows must not be treated as failures or silently cleaned up.
CREATE INDEX chatbot_discovery_flow_pending_idx
    ON public.chatbot_discovery_flow (subject_type, subject_key, quota_date, choice_deadline)
    WHERE stage IN ('awaiting_choice', 'search_pending', 'uncertain');

CREATE INDEX chatbot_discovery_flow_terminal_idx
    ON public.chatbot_discovery_flow (terminal_at)
    WHERE stage IN ('found', 'empty', 'failed', 'cancelled', 'expired');

CREATE INDEX chatbot_discovery_operation_flow_idx
    ON public.chatbot_discovery_operation (subject_type, subject_key, flow_id)
    WHERE flow_id IS NOT NULL;

-- Terminal metadata is retained at least 24 hours after terminal_at; the
-- cleanup and authoritative expiry proof are not implemented by this draft.
CREATE INDEX chatbot_discovery_operation_terminal_idx
    ON public.chatbot_discovery_operation (terminal_at)
    WHERE terminal_at IS NOT NULL;

COMMIT;

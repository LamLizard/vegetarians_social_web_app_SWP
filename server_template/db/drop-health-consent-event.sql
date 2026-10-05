-- Destructive one-time migration: permanently deletes consent history.
-- Run only after confirming that the health_consent_event data is no longer needed.
BEGIN;
DROP TABLE IF EXISTS public.health_consent_event;
COMMIT;

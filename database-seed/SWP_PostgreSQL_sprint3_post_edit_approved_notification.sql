-- Operator-reviewed migration. Apply separately, then restart the server.
ALTER TYPE public.notification_type_enum
  ADD VALUE IF NOT EXISTS 'post_edit_approved';

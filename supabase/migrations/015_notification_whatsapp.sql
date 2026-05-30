-- ============================================================
-- Migration 015: Allow WhatsApp in the notification log
-- ------------------------------------------------------------
-- Adds 'whatsapp' as a channel and 'twilio'/'meta' as providers
-- so WhatsApp notifications can be logged alongside SMS/email.
-- ============================================================

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_channel_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_channel_check
  CHECK (channel IN ('sms', 'email', 'whatsapp'));

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_provider_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_provider_check
  CHECK (provider IN ('arkesel', 'brevio', 'twilio', 'meta'));

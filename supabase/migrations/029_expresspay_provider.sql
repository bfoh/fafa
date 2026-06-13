-- Switch the payment provider from Paystack to ExpressPay.
-- The payments.provider CHECK constraint only allowed ('paystack', 'manual');
-- allow 'expresspay' too. Existing 'paystack' rows are kept for history.
-- provider_ref now stores the ExpressPay transaction token for online payments
-- (used by the webhook + poll reconciliation to query final status).

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('paystack', 'expresspay', 'manual'));

-- New online payments default to ExpressPay.
ALTER TABLE payments
  ALTER COLUMN provider SET DEFAULT 'expresspay';

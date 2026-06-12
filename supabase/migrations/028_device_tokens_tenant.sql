-- Owner devices: link a device token to the tenant whose dashboard the
-- authenticated user belongs to, so new-order / customer-message pushes reach
-- the restaurant's phones. The link is resolved server-side from the session
-- at registration time — never claimed by the client.
ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS device_tokens_tenant_idx
  ON device_tokens (tenant_id)
  WHERE tenant_id IS NOT NULL;

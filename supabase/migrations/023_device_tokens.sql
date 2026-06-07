-- ─── Device push tokens ─────────────────────────────────────
-- Stores FCM/APNs registration tokens from the mobile app so the server can
-- push order updates. Associated to a customer by phone (anonymous ordering)
-- and/or an authenticated user. Written/read by service role only.

CREATE TABLE IF NOT EXISTS device_tokens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token          TEXT NOT NULL UNIQUE,
    platform       TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    customer_phone TEXT,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup tokens by the customer placing an order.
CREATE INDEX IF NOT EXISTS device_tokens_phone_idx
    ON device_tokens (customer_phone);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only (RLS denies all anon/authenticated access).

-- ============================================================
-- Migration 014: Order Messages (customer ↔ restaurant chat)
-- ------------------------------------------------------------
-- A lightweight per-order thread so customers can ask questions
-- or tweak an order while it's in progress. The customer is
-- anonymous (identified by holding the order UUID) and talks via
-- server endpoints; the restaurant talks as an authenticated
-- tenant member (RLS below).
-- ============================================================

CREATE TABLE IF NOT EXISTS order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'restaurant')),
    body TEXT NOT NULL,
    read_by_customer_at TIMESTAMPTZ,
    read_by_restaurant_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id, created_at);
-- Fast unread-from-customer lookups for the dashboard badge.
CREATE INDEX IF NOT EXISTS idx_order_messages_unread_restaurant
    ON order_messages(tenant_id)
    WHERE read_by_restaurant_at IS NULL AND sender = 'customer';

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- Restaurant members read/write/maintain their tenant's threads.
-- (Customers access only through server endpoints via the admin client.)
CREATE POLICY "Members view order messages"
ON order_messages FOR SELECT
USING (tenant_id = public.tenant_id());

CREATE POLICY "Members send order messages"
ON order_messages FOR INSERT
WITH CHECK (tenant_id = public.tenant_id());

CREATE POLICY "Members update order messages"
ON order_messages FOR UPDATE
USING (tenant_id = public.tenant_id());

-- Live dashboard updates (owner side may subscribe).
ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;

-- ============================================================
-- Migration 004: Notification Log
-- ============================================================

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    provider TEXT NOT NULL CHECK (provider IN ('arkesel', 'brevio')),
    recipient TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'delivered')),
    provider_ref TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notification_log_tenant ON notification_log(tenant_id);
CREATE INDEX idx_notification_log_order ON notification_log(order_id);

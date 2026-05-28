-- ============================================================
-- Migration 003: Customers, Orders & Payments
-- ============================================================

-- ─── Customers ──────────────────────────────────────────────

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_phone ON customers(tenant_id, phone);

-- ─── Delivery Zones ────────────────────────────────────────

CREATE TABLE delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    estimated_minutes INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_zones_tenant ON delivery_zones(tenant_id);

-- ─── Orders ─────────────────────────────────────────────────

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),

    order_number TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'confirmed', 'preparing', 'ready',
            'out_for_delivery', 'delivered', 'cancelled'
        )),

    payment_method TEXT NOT NULL
        CHECK (payment_method IN ('card', 'momo', 'cash_on_delivery')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),

    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,

    delivery_type TEXT NOT NULL DEFAULT 'delivery'
        CHECK (delivery_type IN ('delivery', 'pickup')),
    delivery_address TEXT,
    delivery_zone_id UUID REFERENCES delivery_zones(id),
    delivery_lat DECIMAL(10,8),
    delivery_lng DECIMAL(11,8),
    delivery_notes TEXT,

    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,

    estimated_ready_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_number ON orders(tenant_id, order_number);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── Order Items ────────────────────────────────────────────

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    options_json JSONB DEFAULT '[]'::jsonb,
    line_total DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ─── Order Status History ───────────────────────────────────

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- ─── Payments ───────────────────────────────────────────────

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    method TEXT NOT NULL
        CHECK (method IN ('card', 'momo', 'cash')),
    provider TEXT NOT NULL DEFAULT 'paystack'
        CHECK (provider IN ('paystack', 'manual')),
    provider_ref TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(tenant_id, status);

-- ─── Order Number Generator ────────────────────────────────

CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_num INT;
BEGIN
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 4) AS INT)
    ), 0) + 1
    INTO next_num
    FROM orders
    WHERE tenant_id = p_tenant_id;

    RETURN 'FA-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─── Update Customer Stats Trigger ─────────────────────────

CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        UPDATE customers SET
            total_orders = total_orders + 1,
            total_spent = total_spent + NEW.total,
            last_order_at = now()
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_update_customer_stats
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();

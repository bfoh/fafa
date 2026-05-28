-- ============================================================
-- Migration 002: Menu System
-- ============================================================

-- ─── Menu Categories ────────────────────────────────────────

CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_categories_tenant ON menu_categories(tenant_id);

-- ─── Menu Items ─────────────────────────────────────────────

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(tenant_id, is_available);

CREATE TRIGGER menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── Menu Item Options (add-ons, extras) ────────────────────

CREATE TABLE menu_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_modifier DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_item_options_item ON menu_item_options(menu_item_id);

-- ─── Daily Menu (availability overrides per day) ────────────

CREATE TABLE daily_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_available BOOLEAN DEFAULT true,
    quantity_limit INT,
    quantity_sold INT DEFAULT 0,
    UNIQUE(tenant_id, menu_item_id, date)
);

CREATE INDEX idx_daily_menu_tenant_date ON daily_menu(tenant_id, date);

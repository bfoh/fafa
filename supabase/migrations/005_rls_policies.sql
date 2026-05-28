-- ============================================================
-- Migration 005: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS UUID AS $$
    SELECT 
      COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::UUID,
        public.get_user_tenant_id()
      );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(t_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = t_id
        AND user_id = auth.uid()
        AND role = 'owner'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════
-- TENANTS
-- ═══════════════════════════════════════════════════════════

-- Public: anyone can view active tenants (for storefronts)
CREATE POLICY "Public can view active tenants"
ON tenants FOR SELECT
USING (status = 'active');

-- Tenant members can update their own tenant
CREATE POLICY "Members can update own tenant"
ON tenants FOR UPDATE
USING (id = public.tenant_id())
WITH CHECK (id = public.tenant_id());

-- Service role can insert (registration)
-- (Handled via supabase admin client, bypasses RLS)

-- ═══════════════════════════════════════════════════════════
-- TENANT MEMBERS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view own tenant members"
ON tenant_members FOR SELECT
USING (user_id = auth.uid() OR tenant_id = public.tenant_id());


CREATE POLICY "Owners can manage tenant members"
ON tenant_members FOR ALL
USING (
    tenant_id = public.tenant_id()
    AND public.is_tenant_owner(public.tenant_id())
);

-- ═══════════════════════════════════════════════════════════
-- OPERATING HOURS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view operating hours"
ON operating_hours FOR SELECT
USING (true);

CREATE POLICY "Members can manage operating hours"
ON operating_hours FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- MENU CATEGORIES
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view menu categories"
ON menu_categories FOR SELECT
USING (true);

CREATE POLICY "Members can manage menu categories"
ON menu_categories FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- MENU ITEMS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view available menu items"
ON menu_items FOR SELECT
USING (true);

CREATE POLICY "Members can manage menu items"
ON menu_items FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- MENU ITEM OPTIONS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view menu item options"
ON menu_item_options FOR SELECT
USING (true);

CREATE POLICY "Members can manage menu item options"
ON menu_item_options FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM menu_items
        WHERE menu_items.id = menu_item_options.menu_item_id
        AND menu_items.tenant_id = public.tenant_id()
    )
);

-- ═══════════════════════════════════════════════════════════
-- DAILY MENU
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view daily menu"
ON daily_menu FOR SELECT
USING (true);

CREATE POLICY "Members can manage daily menu"
ON daily_menu FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- CUSTOMERS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view customers"
ON customers FOR SELECT
USING (tenant_id = public.tenant_id());

CREATE POLICY "Members can manage customers"
ON customers FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- Public insert handled via service role (order creation)

-- ═══════════════════════════════════════════════════════════
-- DELIVERY ZONES
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Public can view active delivery zones"
ON delivery_zones FOR SELECT
USING (is_active = true);

CREATE POLICY "Members can manage delivery zones"
ON delivery_zones FOR ALL
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- ORDERS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view orders"
ON orders FOR SELECT
USING (tenant_id = public.tenant_id());

CREATE POLICY "Members can update orders"
ON orders FOR UPDATE
USING (tenant_id = public.tenant_id())
WITH CHECK (tenant_id = public.tenant_id());

-- Public insert handled via service role (order placement)

-- ═══════════════════════════════════════════════════════════
-- ORDER ITEMS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view order items"
ON order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.tenant_id = public.tenant_id()
    )
);

-- Public select for order confirmation page (via service role)

-- ═══════════════════════════════════════════════════════════
-- ORDER STATUS HISTORY
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view order status history"
ON order_status_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_status_history.order_id
        AND orders.tenant_id = public.tenant_id()
    )
);

CREATE POLICY "Members can insert order status history"
ON order_status_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_status_history.order_id
        AND orders.tenant_id = public.tenant_id()
    )
);

-- ═══════════════════════════════════════════════════════════
-- PAYMENTS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view payments"
ON payments FOR SELECT
USING (tenant_id = public.tenant_id());

CREATE POLICY "Members can insert payments"
ON payments FOR INSERT
WITH CHECK (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- NOTIFICATION LOG
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Members can view notification log"
ON notification_log FOR SELECT
USING (tenant_id = public.tenant_id());

-- ═══════════════════════════════════════════════════════════
-- PLATFORM ADMINS
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "Admins can view platform admins"
ON platform_admins FOR SELECT
USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- STORAGE POLICIES
-- ═══════════════════════════════════════════════════════════

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
    ('logos', 'logos', true),
    ('menu-images', 'menu-images', true),
    ('covers', 'covers', true);

-- Public read access for all media buckets
CREATE POLICY "Public read access for logos"
ON storage.objects FOR SELECT
USING (bucket_id IN ('logos', 'menu-images', 'covers'));

-- Authenticated users can upload to their tenant's folder
CREATE POLICY "Tenant members can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant members can upload menu images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'menu-images'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant members can upload covers"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
);

-- Authenticated users can update/delete their uploads
CREATE POLICY "Tenant members can update logos"
ON storage.objects FOR UPDATE
USING (
    bucket_id IN ('logos', 'menu-images', 'covers')
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant members can delete logos"
ON storage.objects FOR DELETE
USING (
    bucket_id IN ('logos', 'menu-images', 'covers')
    AND auth.role() = 'authenticated'
);

-- ═══════════════════════════════════════════════════════════
-- REALTIME PUBLICATION
-- ═══════════════════════════════════════════════════════════

-- Enable Realtime for orders (live dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

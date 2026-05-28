-- ============================================================
-- Migration 001: Tenants & Authentication
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tenants ────────────────────────────────────────────────

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    tagline TEXT,

    -- Branding
    logo_url TEXT,
    cover_image_url TEXT,
    primary_color TEXT DEFAULT '#FF6B35',
    secondary_color TEXT DEFAULT '#1A1A2E',

    -- Contact
    phone TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,

    -- Location
    address TEXT,
    city TEXT,
    region TEXT,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),

    -- Business config
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    accepts_delivery BOOLEAN DEFAULT true,
    accepts_pickup BOOLEAN DEFAULT false,
    accepts_pay_online BOOLEAN DEFAULT true,
    accepts_pay_on_delivery BOOLEAN DEFAULT true,

    -- Paystack
    paystack_subaccount_code TEXT,

    -- Notification preferences
    notify_sms BOOLEAN DEFAULT true,
    notify_email BOOLEAN DEFAULT true,
    notify_whatsapp BOOLEAN DEFAULT false,

    -- Status
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('onboarding', 'active', 'suspended', 'deactivated')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ─── Tenant Members ─────────────────────────────────────────

CREATE TABLE tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner', 'manager', 'staff')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);

-- ─── Operating Hours ────────────────────────────────────────

CREATE TABLE operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    UNIQUE(tenant_id, day_of_week)
);

-- ─── Platform Admins ────────────────────────────────────────

CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- ─── Updated_at trigger function ────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── JWT Custom Claims Hook ────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
    claims JSONB;
    member_record RECORD;
BEGIN
    claims := event->'claims';

    SELECT tm.tenant_id, tm.role, t.slug, t.name as tenant_name
    INTO member_record
    FROM tenant_members tm
    JOIN tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = (event->>'user_id')::UUID
    LIMIT 1;

    IF member_record IS NOT NULL THEN
        claims := jsonb_set(claims, '{tenant_id}', to_jsonb(member_record.tenant_id::text));
        claims := jsonb_set(claims, '{tenant_role}', to_jsonb(member_record.role));
        claims := jsonb_set(claims, '{tenant_slug}', to_jsonb(member_record.slug));
        claims := jsonb_set(claims, '{tenant_name}', to_jsonb(member_record.tenant_name));
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to supabase_auth_admin for the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

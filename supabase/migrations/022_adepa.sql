-- ============================================================
-- Migration 022: Adepa — local-voice toggle + conversation analytics
-- ------------------------------------------------------------
-- 1. Per-tenant "local voice" dialect toggle for the concierge.
-- 2. adepa_conversations: one row per chat session (web or WhatsApp)
--    used for observability and the chat -> order conversion metric.
-- Conversation rows are written by the chat/webhook routes via the
-- service-role admin client (bypasses RLS); tenant members read their
-- own for the analytics dashboard.
-- ============================================================

-- ─── 1. Local voice toggle ──────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS adepa_local_voice BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Conversation analytics ──────────────────────────────
CREATE TABLE IF NOT EXISTS adepa_conversations (
    -- Client-generated session id (web) or derived id (WhatsApp). The
    -- routes upsert on this so a session is one row, not one row per turn.
    id          UUID PRIMARY KEY,
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,

    channel     TEXT NOT NULL DEFAULT 'web'
                CHECK (channel IN ('web', 'whatsapp')),
    mode        TEXT NOT NULL DEFAULT 'marketplace'
                CHECK (mode IN ('storefront', 'marketplace')),
    model       TEXT,

    -- Rolling counters updated each turn.
    turns       INT NOT NULL DEFAULT 0,
    tool_calls  INT NOT NULL DEFAULT 0,
    tools_used  TEXT[] NOT NULL DEFAULT '{}',

    -- Funnel outcome — the north-star is browsing -> ordered.
    outcome     TEXT NOT NULL DEFAULT 'browsing'
                CHECK (outcome IN ('browsing', 'added_to_cart', 'checkout', 'ordered', 'escalated')),
    order_number TEXT,
    order_total  NUMERIC(10,2),

    -- WhatsApp channel: the customer's phone (so a session resumes).
    wa_phone    TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adepa_conv_tenant
  ON adepa_conversations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adepa_conv_outcome
  ON adepa_conversations(tenant_id, outcome);

-- Resume a WhatsApp session by phone within a tenant.
CREATE INDEX IF NOT EXISTS idx_adepa_conv_wa
  ON adepa_conversations(tenant_id, wa_phone)
  WHERE wa_phone IS NOT NULL;

CREATE TRIGGER adepa_conversations_updated_at
    BEFORE UPDATE ON adepa_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE adepa_conversations ENABLE ROW LEVEL SECURITY;

-- Tenant members read their own conversations (writes go via service role).
CREATE POLICY "Members can view own adepa conversations"
ON adepa_conversations FOR SELECT
USING (tenant_id = public.tenant_id());

-- ─── 3. WhatsApp channel sessions ───────────────────────────
-- WhatsApp is stateless per inbound message, so we keep a short rolling
-- transcript per (tenant, phone) to give the concierge continuity. Written
-- only by the webhook (service role); never read on the client.
CREATE TABLE IF NOT EXISTS adepa_wa_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone           TEXT NOT NULL,
    -- Same id used in adepa_conversations so WhatsApp shows in the dashboard.
    conversation_id UUID NOT NULL,
    history         JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, phone)
);

ALTER TABLE adepa_wa_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only (RLS denies all anon/authenticated access).

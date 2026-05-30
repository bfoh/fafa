-- ============================================================
-- Migration 016: Ratings & Reviews
-- ------------------------------------------------------------
-- Verified reviews: one per order, left by the customer after the
-- order is delivered (enforced in the server endpoint). Tenant
-- aggregates are denormalized for fast marketplace display/ranking
-- and kept in sync by a trigger.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    customer_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON reviews(tenant_id, created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are public (shown on storefronts & the marketplace).
CREATE POLICY "Public can view reviews"
ON reviews FOR SELECT
USING (true);
-- Customers submit through the server (admin client); no public insert.

-- ─── Denormalized aggregates on tenants ─────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1) DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_tenant_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tid UUID;
BEGIN
    tid := COALESCE(NEW.tenant_id, OLD.tenant_id);
    UPDATE tenants SET
        rating_count = (SELECT count(*) FROM reviews WHERE tenant_id = tid),
        rating_avg = COALESCE((SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE tenant_id = tid), 0)
    WHERE id = tid;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_recompute ON reviews;
CREATE TRIGGER reviews_recompute
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.recompute_tenant_rating();

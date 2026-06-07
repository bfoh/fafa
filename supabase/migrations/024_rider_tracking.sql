-- ─── Rider live tracking ────────────────────────────────────
-- Assign a delivery rider to an order and stream their GPS breadcrumbs so the
-- customer can watch the delivery on a map. Writes are service-role only (via
-- the /api/rider/location endpoint, after JWT + assignment checks); reads are
-- public by order_id (an unguessable UUID — same model as public order tracking).

-- 1. Rider assignment on the order.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS orders_rider_idx ON orders (rider_id);

-- 2. Breadcrumb trail.
CREATE TABLE IF NOT EXISTS rider_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    accuracy    DOUBLE PRECISION,
    bearing     DOUBLE PRECISION,
    speed       DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rider_locations_order_idx
    ON rider_locations (order_id, recorded_at DESC);

ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;

-- Public read by order_id (unguessable UUID). No INSERT/UPDATE policy →
-- writes are service-role only.
DROP POLICY IF EXISTS rider_locations_public_read ON rider_locations;
CREATE POLICY rider_locations_public_read
    ON rider_locations FOR SELECT
    USING (true);

-- 3. Stream INSERTs to the customer's map via Supabase Realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE rider_locations;

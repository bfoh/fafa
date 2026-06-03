-- Distance-based delivery pricing: per-restaurant rate config + order distance record.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS free_delivery_radius_km NUMERIC DEFAULT 3,
  ADD COLUMN IF NOT EXISTS per_km_rate NUMERIC,            -- NULL → platform default
  ADD COLUMN IF NOT EXISTS max_delivery_distance_km NUMERIC; -- NULL → no cap

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_area_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC;

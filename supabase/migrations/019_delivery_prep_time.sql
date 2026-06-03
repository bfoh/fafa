-- Per-restaurant average prep time, used for the checkout delivery-time estimate.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS avg_prep_minutes INT DEFAULT 20;

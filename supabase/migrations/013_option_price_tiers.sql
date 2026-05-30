-- ============================================================
-- Migration 013: Price tiers for protein options
-- ------------------------------------------------------------
-- Chop-bar proteins (fish, meats) are commonly sold at several
-- fixed price points / portion sizes rather than a single price
-- (e.g. Dry Fish: 60 / 80 / 100 / 120). Store these as an ordered
-- JSON array of { label, price } objects. NULL/empty means the
-- option falls back to free-amount entry (min_quantity).
-- ============================================================

ALTER TABLE public.menu_item_options
  ADD COLUMN IF NOT EXISTS price_tiers JSONB;

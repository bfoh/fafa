-- ============================================================
-- Migration 011: Option Types & Minimum Quantity
-- Adds categorization (soup/protein/extra) and min order
-- amounts to menu_item_options.
-- ============================================================

ALTER TABLE public.menu_item_options
  ADD COLUMN IF NOT EXISTS option_type TEXT DEFAULT 'extra',
  ADD COLUMN IF NOT EXISTS min_quantity DECIMAL(10,2) DEFAULT 0;

-- Back-fill any NULL option_type values
UPDATE public.menu_item_options
  SET option_type = 'extra'
  WHERE option_type IS NULL;

-- ============================================================
-- Migration 008: Chop Bar Menu Items
-- ============================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_chop_bar BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_menu_items_chop_bar
  ON menu_items(is_chop_bar)
  WHERE is_chop_bar = true;

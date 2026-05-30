-- ============================================================
-- Migration 010: Menu Item Option Sub-options
-- ============================================================

ALTER TABLE public.menu_item_options
  ADD COLUMN IF NOT EXISTS sub_options TEXT;

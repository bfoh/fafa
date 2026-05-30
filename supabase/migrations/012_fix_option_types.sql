-- ============================================================
-- Migration 012: Repair mis-typed & duplicated chop-bar options
-- ------------------------------------------------------------
-- Options saved before option_type persisted all defaulted to
-- 'extra', so soups/proteins render in the wrong section of the
-- customer bowl builder. Repeated "Load Defaults" also left
-- exact-duplicate rows. This back-fills the correct type for
-- well-known free options and removes the duplicates.
-- ============================================================

-- 1. Re-classify well-known SOUPS (only free, currently 'extra')
UPDATE public.menu_item_options
SET option_type = 'soup'
WHERE option_type = 'extra'
  AND price_modifier = 0
  AND (
    lower(name) LIKE '% soup'
    OR lower(name) IN (
      'light soup', 'abunabunu soup', 'peanut soup', 'palm nut soup',
      'groundnut soup', 'okro soup', 'okra soup', 'green green', 'nkrakra'
    )
  );

-- 2. Re-classify well-known PROTEINS (only free, currently 'extra')
UPDATE public.menu_item_options
SET option_type = 'protein'
WHERE option_type = 'extra'
  AND price_modifier = 0
  AND lower(name) IN (
    'goat meat', 'beef', 'chicken', 'fish', 'mutton', 'turkey',
    'cow leg', 'cow foot', 'gizzard'
  );

-- 3. Remove exact-duplicate options, keeping the earliest row per
--    (menu_item_id, name, option_type, price_modifier).
DELETE FROM public.menu_item_options a
USING public.menu_item_options b
WHERE a.menu_item_id = b.menu_item_id
  AND lower(a.name) = lower(b.name)
  AND a.option_type = b.option_type
  AND a.price_modifier = b.price_modifier
  AND a.ctid > b.ctid;

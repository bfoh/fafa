-- ============================================================
-- Migration 017: Review replies + feed rating into ranking
-- ------------------------------------------------------------
-- 1. Restaurants can reply to a review.
-- 2. search_kitchens returns rating_avg/rating_count and ranks
--    higher-rated kitchens above lower-rated ones.
-- ============================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_reply_at TIMESTAMPTZ;

-- Return type changes, so drop before recreate.
DROP FUNCTION IF EXISTS public.search_kitchens(
  TEXT, TEXT[], TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INT, INT
);

CREATE FUNCTION public.search_kitchens(
  p_q        TEXT DEFAULT NULL,
  p_cuisines TEXT[] DEFAULT NULL,
  p_city     TEXT DEFAULT NULL,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_limit    INT DEFAULT 24,
  p_offset   INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  tagline TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  city TEXT,
  region TEXT,
  cuisines TEXT[],
  delivery_fee NUMERIC,
  min_order_amount NUMERIC,
  item_count INT,
  open_now BOOLEAN,
  distance_km DOUBLE PRECISION,
  rating_avg NUMERIC,
  rating_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH loc AS (
    SELECT
      (now() AT TIME ZONE 'Africa/Accra')::time AS lt,
      EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Accra'))::int AS ld
  )
  SELECT
    t.id, t.name, t.slug, t.tagline, t.logo_url, t.cover_image_url,
    t.city, t.region, t.cuisines, t.delivery_fee, t.min_order_amount,
    (SELECT count(*)::int FROM menu_items mi
       WHERE mi.tenant_id = t.id AND mi.is_available) AS item_count,
    COALESCE(
      (SELECT (NOT oh.is_closed)
              AND ((SELECT lt FROM loc) BETWEEN oh.open_time AND oh.close_time)
         FROM operating_hours oh
         WHERE oh.tenant_id = t.id
           AND oh.day_of_week = (SELECT ld FROM loc)
         LIMIT 1),
      (SELECT count(*) = 0 FROM operating_hours oh2 WHERE oh2.tenant_id = t.id)
    ) AS open_now,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
       AND t.location_lat IS NOT NULL AND t.location_lng IS NOT NULL
      THEN 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(t.location_lat)) *
        cos(radians(t.location_lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(t.location_lat))
      )))
      ELSE NULL
    END AS distance_km,
    COALESCE(t.rating_avg, 0) AS rating_avg,
    COALESCE(t.rating_count, 0) AS rating_count
  FROM tenants t
  WHERE t.status = 'active'
    AND EXISTS (SELECT 1 FROM menu_items mi
                 WHERE mi.tenant_id = t.id AND mi.is_available)
    AND (p_cuisines IS NULL OR array_length(p_cuisines, 1) IS NULL
         OR t.cuisines && p_cuisines)
    AND (p_city IS NULL OR p_city = '' OR t.city = p_city)
    AND (
      p_q IS NULL OR p_q = '' OR
      t.name ILIKE '%' || p_q || '%' OR
      COALESCE(t.tagline, '') ILIKE '%' || p_q || '%' OR
      COALESCE(t.description, '') ILIKE '%' || p_q || '%' OR
      EXISTS (SELECT 1 FROM menu_items mi
                WHERE mi.tenant_id = t.id AND mi.is_available
                  AND mi.name ILIKE '%' || p_q || '%')
    )
  ORDER BY
    distance_km ASC NULLS LAST,
    (CASE WHEN p_city IS NOT NULL AND p_city <> '' AND t.city = p_city
          THEN 0 ELSE 1 END),
    open_now DESC,
    COALESCE(t.rating_avg, 0) DESC,
    t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 60))
  OFFSET GREATEST(0, p_offset);
$$;

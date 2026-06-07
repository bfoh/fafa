-- ─── Harden rider_locations access ──────────────────────────
-- 024 exposed rider_locations to anon via `USING (true)` so the customer map
-- could subscribe over Realtime. But the anon key ships inside the app bundle,
-- so that policy let anyone enumerate EVERY rider's live coordinates across all
-- tenants. Anonymous customers can't be scoped to "their" order via RLS, so we
-- remove anon access entirely and serve tracking through
-- /api/orders/[id]/location (service role, keyed by the unguessable order_id) —
-- the same model as public order tracking. Service-role writes are unchanged.

DROP POLICY IF EXISTS rider_locations_public_read ON rider_locations;

-- No longer read by the anon client → drop from the Realtime publication.
-- (Guarded: ignore if it was already removed.)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE rider_locations;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

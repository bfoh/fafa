-- Atomic, monotonic per-tenant order numbers.
--
-- The old generate_order_number computed MAX(order_number)+1 per tenant. That is
-- not concurrency-safe (two near-simultaneous orders read the same MAX and both
-- get e.g. FA-0001) and it RESETS when orders are deleted (MAX drops), producing
-- duplicate numbers. Replace it with a per-tenant counter incremented atomically
-- via UPDATE ... RETURNING (row lock), which never repeats or resets.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS order_seq INT NOT NULL DEFAULT 0;

-- Seed each tenant's counter from its current highest FA-#### number so existing
-- numbering continues without collision.
UPDATE tenants t
SET order_seq = COALESCE((
  SELECT MAX(CAST(SUBSTRING(o.order_number FROM 4) AS INT))
  FROM orders o
  WHERE o.tenant_id = t.id
    AND o.order_number ~ '^FA-[0-9]+$'
), 0);

CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_num INT;
BEGIN
    UPDATE tenants
       SET order_seq = order_seq + 1
     WHERE id = p_tenant_id
    RETURNING order_seq INTO next_num;

    IF next_num IS NULL THEN
        -- Tenant row missing (should not happen) — fall back to a timestamp tail.
        RETURN 'FA-' || LPAD((EXTRACT(EPOCH FROM now())::BIGINT % 10000)::TEXT, 4, '0');
    END IF;

    RETURN 'FA-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

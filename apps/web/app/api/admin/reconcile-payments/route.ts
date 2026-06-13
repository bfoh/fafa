import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { reconcileExpressPayOrder } from '@/lib/expresspay/client';

// Sweep historical online orders that are still `pending` (e.g. paid before the
// callback-verification fix shipped, when the webhook was the only settle path)
// and settle any that ExpressPay confirms as successful. Idempotent and
// platform-admin only. Bounded so a single run can't fan out unboundedly.

const MAX_ORDERS = 200;
const LOOKBACK_DAYS = 90;

export async function POST() {
  const { isAdmin } = await getPlatformAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total, payment_method, payment_status, created_at')
    .eq('payment_status', 'pending')
    .in('payment_method', ['momo', 'card'])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_ORDERS);

  if (error) {
    return NextResponse.json({ error: 'Failed to load pending orders' }, { status: 500 });
  }

  let checked = 0;
  let settled = 0;
  let failed = 0;

  for (const order of orders || []) {
    checked += 1;
    try {
      const paid = await reconcileExpressPayOrder(order.id);
      if (paid) settled += 1;
    } catch {
      // Unknown token / network error — leave it pending for a later run.
      failed += 1;
    }
  }

  return NextResponse.json({ checked, settled, failed });
}

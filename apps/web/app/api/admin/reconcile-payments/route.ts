import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { verifyTransaction } from '@/lib/paystack/client';
import { settlePaidOrder } from '@/lib/orders/settle';

// Sweep historical online orders that are still `pending` (e.g. paid before the
// callback-verification fix shipped, when the webhook was the only settle path)
// and settle any that Paystack confirms as successful. Idempotent and
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
      const verification = await verifyTransaction(order.id);
      const data = verification.data;
      if (
        data?.status === 'success' &&
        Number(data.amount) >= Math.round(Number(order.total) * 100)
      ) {
        const result = await settlePaidOrder(order.id, {
          channel: data.channel,
          providerRef: String(data.id),
        });
        if (result.settled) settled += 1;
      }
    } catch {
      // Unknown reference / network error — leave it pending for a later run.
      failed += 1;
    }
  }

  return NextResponse.json({ checked, settled, failed });
}

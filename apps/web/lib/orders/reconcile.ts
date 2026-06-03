import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTransaction } from '@/lib/paystack/client';
import { settlePaidOrder } from '@/lib/orders/settle';

const LOOKBACK_HOURS = 24;
const MAX_ORDERS = 15;

/**
 * Verify a single tenant's recent pending online orders against Paystack and
 * settle the ones that actually succeeded. Used on the restaurant's dashboard /
 * orders read paths so a paid momo/card order shows up even when the webhook and
 * the customer-callback verification both missed it.
 *
 * Only hits Paystack when there are unsettled online orders, so the common case
 * (everything already paid) costs nothing. Returns how many were newly settled.
 */
export async function reconcileTenantPendingPayments(tenantId: string): Promise<number> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const { data: pending } = await supabase
    .from('orders')
    .select('id, total')
    .eq('tenant_id', tenantId)
    .eq('payment_status', 'pending')
    .in('payment_method', ['momo', 'card'])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_ORDERS);

  if (!pending || pending.length === 0) return 0;

  const results = await Promise.all(
    pending.map(async (order): Promise<number> => {
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
          return result.settled ? 1 : 0;
        }
      } catch {
        // Unknown reference / network error — leave pending for the next read.
      }
      return 0;
    })
  );

  return results.reduce((sum, n) => sum + n, 0);
}

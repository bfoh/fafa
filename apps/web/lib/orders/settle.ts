import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderNotifications } from '@/lib/notifications/send';

/**
 * Settle an order's online payment as paid. Idempotent: a no-op if the order is
 * already paid. Shared by the Paystack webhook (async) and the callback
 * verification on the order confirmation page (authoritative on return), so the
 * two paths can never diverge.
 */
export async function settlePaidOrder(
  orderId: string,
  opts: { channel?: string | null; providerRef?: string | null } = {}
): Promise<{ settled: boolean; alreadyPaid?: boolean }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .single();

  if (!existing) return { settled: false };
  if (existing.payment_status === 'paid') return { settled: false, alreadyPaid: true };

  // Mark the pending payment record (created at order time) as successful.
  await supabase
    .from('payments')
    .update({
      status: 'success',
      provider_ref: opts.providerRef ?? null,
      method: opts.channel === 'mobile_money' ? 'momo' : 'card',
      paid_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  const { data: order, error } = await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId)
    .select()
    .single();

  if (!error && order) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', order.tenant_id)
      .single();

    if (tenant) {
      sendOrderNotifications({ order, tenant }, 'payment_confirmed')
        .then(() => sendOrderNotifications({ order, tenant }, 'order_placed'))
        .catch((err) => console.error('Failed to send settle notifications:', err));
    }
  }

  return { settled: true };
}

import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush, isPushConfigured } from '@/lib/push/fcm';
import type { Order, Tenant, NotificationEvent } from '@fafa/types';

/** Short push copy per order event. Returns null for events we don't push. */
function pushBody(event: NotificationEvent, tenantName: string): string | null {
  switch (event) {
    case 'order_placed':
      return `Order received by ${tenantName}.`;
    case 'payment_confirmed':
      return 'Payment confirmed. Your order is being prepared.';
    case 'order_confirmed':
      return `${tenantName} confirmed your order.`;
    case 'order_ready':
      return 'Your order is ready!';
    case 'order_out_for_delivery':
      return 'Your order is on the way.';
    case 'order_delivered':
      return 'Delivered. Enjoy your meal!';
    case 'order_cancelled':
      return 'Your order was cancelled.';
    default:
      return null;
  }
}

/**
 * Push an order update to the customer's registered devices. Best-effort and
 * fully env-gated — a no-op when FCM isn't configured or the customer has no
 * registered device. Tapping the notification deep-links into the tracker.
 */
export async function sendOrderPush(
  ctx: { order: Order; tenant: Tenant },
  event: NotificationEvent
): Promise<void> {
  const { order, tenant } = ctx;
  console.log('[push] sendOrderPush called', { event, phone: order.customer_phone, configured: isPushConfigured() });
  if (!isPushConfigured() || !order.customer_phone) return;

  const body = pushBody(event, tenant.name);
  if (!body) return;

  try {
    const supabase = createAdminClient();
    const { data: rows } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('customer_phone', order.customer_phone);

    console.log('[push] tokens found:', rows?.length ?? 0, 'for phone:', order.customer_phone);
    const tokens = (rows || []).map((r) => r.token as string);
    if (tokens.length === 0) return;

    const sent = await sendPush(tokens, {
      title: `Order #${order.order_number}`,
      body,
      data: { orderId: order.id, slug: tenant.slug },
    });
    console.log('[push] sendPush result:', sent, '/', tokens.length, 'delivered');
  } catch (err) {
    console.error('[push] sendOrderPush failed:', err);
  }
}

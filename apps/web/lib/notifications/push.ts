import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush, isPushConfigured } from '@/lib/push/fcm';
import { formatGHS } from '@/lib/utils/currency';
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
    case 'order_preparing':
      return 'Your food is being prepared. 🍳';
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
/**
 * All device tokens belonging to the restaurant: devices linked to the tenant
 * via an authenticated dashboard session, plus the legacy reach of devices
 * registered under the restaurant's own phone number at checkout.
 */
export async function getOwnerDeviceTokens(tenant: {
  id: string;
  phone?: string | null;
}): Promise<string[]> {
  const supabase = createAdminClient();
  const filters = [`tenant_id.eq.${tenant.id}`];
  if (tenant.phone) filters.push(`customer_phone.eq.${tenant.phone}`);
  const { data } = await supabase
    .from('device_tokens')
    .select('token')
    .or(filters.join(','));
  return [...new Set((data || []).map((r) => r.token as string))];
}

/** Owner-facing push copy. Only events the restaurant must act on. */
function ownerPushBody(
  event: NotificationEvent,
  order: Order
): { title: string; body: string } | null {
  const amount = formatGHS(Number(order.total));
  const leg = order.delivery_type === 'pickup' ? 'Pickup' : 'Delivery';
  switch (event) {
    case 'order_placed':
      return {
        title: `New order #${order.order_number} 🛎️`,
        body: `${order.customer_name} · ${amount} · ${leg}`,
      };
    case 'payment_confirmed':
      return {
        title: `Payment received — #${order.order_number}`,
        body: `${amount} via ${order.payment_method === 'momo' ? 'Mobile Money' : order.payment_method}`,
      };
    default:
      return null;
  }
}

/**
 * Push an order event to the restaurant's devices. Best-effort and env-gated
 * like sendOrderPush. Tapping opens the orders dashboard.
 */
export async function sendOwnerOrderPush(
  ctx: { order: Order; tenant: Tenant },
  event: NotificationEvent
): Promise<void> {
  const { order, tenant } = ctx;
  if (!isPushConfigured()) return;

  const msg = ownerPushBody(event, order);
  if (!msg) return;

  try {
    const tokens = await getOwnerDeviceTokens(tenant);
    if (tokens.length === 0) return;
    await sendPush(tokens, { ...msg, data: { path: '/orders' } });
  } catch (err) {
    console.error('[push] sendOwnerOrderPush failed:', err);
  }
}

export async function sendOrderPush(
  ctx: { order: Order; tenant: Tenant },
  event: NotificationEvent
): Promise<void> {
  const { order, tenant } = ctx;
  if (!isPushConfigured() || !order.customer_phone) return;

  const body = pushBody(event, tenant.name);
  if (!body) return;

  try {
    const supabase = createAdminClient();
    const { data: rows } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('customer_phone', order.customer_phone);

    const tokens = (rows || []).map((r) => r.token as string);
    if (tokens.length === 0) return;

    await sendPush(tokens, {
      title: `Order #${order.order_number}`,
      body,
      data: { orderId: order.id, slug: tenant.slug },
    });
  } catch (err) {
    console.error('[push] sendOrderPush failed:', err);
  }
}

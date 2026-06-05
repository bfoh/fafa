import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { OrderTracker, type TrackedOrder, type HistoryEntry } from '@/components/storefront/order-tracker';
import { AdepaConversion } from '@/components/adepa/adepa-conversion';
import { verifyTransaction } from '@/lib/paystack/client';
import { settlePaidOrder } from '@/lib/orders/settle';

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const supabase = createAdminClient();

  // Fetch order with items (first paint — the client tracker then polls live).
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, payment_status, payment_method,
      delivery_type, delivery_address, subtotal, delivery_fee, total,
      estimated_ready_at, confirmed_at, ready_at, delivered_at,
      cancelled_at, cancellation_reason, created_at, updated_at,
      order_items ( id, item_name, quantity, line_total, options_json )
    `)
    .eq('id', orderId)
    .single();

  if (!order) notFound();

  // Authoritative payment settlement on return from Paystack. The webhook is an
  // async backup that can be missed/misconfigured; verifying here guarantees the
  // order is marked paid (and counted as revenue) once the customer lands back
  // on this confirmation page. Idempotent and a no-op for paid / COD orders.
  if (
    order.payment_status === 'pending' &&
    order.payment_method !== 'cash_on_delivery'
  ) {
    try {
      const verification = await verifyTransaction(order.id);
      const data = verification.data;
      if (
        data?.status === 'success' &&
        Number(data.amount) >= Math.round(Number(order.total) * 100)
      ) {
        await settlePaidOrder(order.id, {
          channel: data.channel,
          providerRef: String(data.id),
        });
        order.payment_status = 'paid';
      }
    } catch (err) {
      console.error('Callback payment verification failed:', err);
    }
  }

  const { data: history } = await supabase
    .from('order_status_history')
    .select('to_status, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  // Tenant branding / contact
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, phone, whatsapp, primary_color')
    .eq('slug', slug)
    .single();

  return (
    <>
      <AdepaConversion
        slug={slug}
        orderNumber={order.order_number}
        total={Number(order.total)}
      />
      <OrderTracker
        initialOrder={order as unknown as TrackedOrder}
        initialHistory={(history as HistoryEntry[]) || []}
        slug={slug}
        tenant={{
          name: tenant?.name || 'this restaurant',
          phone: tenant?.phone || null,
          whatsapp: tenant?.whatsapp || null,
          primary_color: tenant?.primary_color || '#FF6B35',
        }}
      />
    </>
  );
}

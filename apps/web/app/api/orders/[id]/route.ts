import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderNotifications } from '@/lib/notifications/send';
import { verifyTransaction } from '@/lib/paystack/client';
import { settlePaidOrder } from '@/lib/orders/settle';
import { getResolvedTenantId } from '@/lib/admin/guard';
import type { OrderStatus, PaymentStatus } from '@fafa/types';

/* ── Public order tracking ──────────────────────────────────
   Lets the customer's browser poll live status without auth.
   The order id is an unguessable UUID, and we return only the
   fields needed to render the tracker (no internal/PII beyond
   what the customer themselves submitted). Uses the admin client
   so it works for anonymous visitors despite RLS. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status, payment_method,
        delivery_type, delivery_address, subtotal, delivery_fee, total,
        estimated_ready_at, confirmed_at, ready_at, delivered_at,
        cancelled_at, cancellation_reason, created_at, updated_at,
        order_items ( id, item_name, quantity, line_total, options_json )
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Reconcile async online payments (e.g. mobile money that settles after the
    // customer is redirected back). The tracker polls this endpoint, so each
    // poll re-verifies while the payment is still pending — self-limiting, since
    // it stops once the order is paid. Webhook remains the async backup.
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
        console.error('Order poll payment verification failed:', err);
      }
    }

    const { data: history } = await supabase
      .from('order_status_history')
      .select('to_status, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ order, history: history || [] });
  } catch (err) {
    console.error('Failed to load order tracking:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, cancellationReason, estimatedReadyMinutes } = await req.json();

    const authClient = await createServerClient();
    const { data: { session } } = await authClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Resolve the active tenant — honours platform-admin impersonation, so an
    //    admin managing a restaurant's orders resolves to the impersonated tenant
    //    (not their own). Non-admins always resolve to their own membership.
    const { tenantId } = await getResolvedTenantId();

    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service-role client for the mutation, authorised by the resolved tenant and
    // scoped by tenant_id below. Bypasses RLS so impersonated writes succeed.
    const supabase = createAdminClient();

    // 2. Fetch the order to verify ownership
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const oldStatus = order.status;

    // 3. Prepare payload for order update
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'confirmed') {
      updatePayload.confirmed_at = new Date().toISOString();
      if (estimatedReadyMinutes) {
        const readyAt = new Date();
        readyAt.setMinutes(readyAt.getMinutes() + parseInt(estimatedReadyMinutes));
        updatePayload.estimated_ready_at = readyAt.toISOString();
      }
    } else if (status === 'ready') {
      updatePayload.ready_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
      // If cash on delivery, auto-settle payment to 'paid'
      if (order.payment_method === 'cash_on_delivery') {
        updatePayload.payment_status = 'paid' as PaymentStatus;
      }
    } else if (status === 'cancelled') {
      updatePayload.cancelled_at = new Date().toISOString();
      updatePayload.cancellation_reason = cancellationReason || 'Cancelled by restaurant';
    }

    // 4. Update the order
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr || !updatedOrder) {
      throw updateErr || new Error('Failed to update order');
    }

    // 5. If transitioning to delivered and cash on delivery, create manual payment record
    if (status === 'delivered' && order.payment_method === 'cash_on_delivery') {
      // Check if payment already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', id)
        .single();

      if (!existingPayment) {
        await supabase.from('payments').insert({
          tenant_id: tenantId,
          order_id: id,
          amount: Number(order.total),
          method: 'cash',
          provider: 'manual',
          status: 'success',
          paid_at: new Date().toISOString(),
        });
      } else {
        await supabase
          .from('payments')
          .update({
            status: 'success',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', id);
      }
    }

    // 6. Record in order_status_history
    await supabase.from('order_status_history').insert({
      order_id: id,
      from_status: oldStatus,
      to_status: status,
      changed_by: session.user.id,
      note: status === 'cancelled' ? cancellationReason : null,
    });

    // 7. Fetch tenant details for notification context
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    // 8. Trigger unified notifications in background (don't block API response)
    if (tenant) {
      let eventType = null;
      if (status === 'confirmed') eventType = 'order_confirmed';
      else if (status === 'ready') eventType = 'order_ready';
      else if (status === 'out_for_delivery') eventType = 'order_out_for_delivery';
      else if (status === 'delivered') eventType = 'order_delivered';
      else if (status === 'cancelled') eventType = 'order_cancelled';

      if (eventType) {
        await sendOrderNotifications(
          {
            order: updatedOrder,
            tenant,
          },
          eventType as any
        ).catch((err) => {
          console.error('Failed to send order transition notifications:', err);
        });
      }
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    console.error('Failed to transition order status:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

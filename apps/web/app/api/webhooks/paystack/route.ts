import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/paystack/client';
import { sendOrderNotifications } from '@/lib/notifications/send';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    // 1. Verify signature
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const supabase = createAdminClient();

    switch (event.event) {
      case 'charge.success': {
        const { reference, metadata, channel } = event.data;
        const orderId = metadata?.order_id || reference;

        // Update payment
        await supabase
          .from('payments')
          .update({
            status: 'success',
            provider_ref: String(event.data.id),
            method: channel === 'mobile_money' ? 'momo' : 'card',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        // Update order payment status
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', orderId)
          .select()
          .single();

        if (!orderErr && order) {
          // Fetch tenant
          const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', order.tenant_id)
            .single();

          if (tenant) {
            // Trigger notifications
            sendOrderNotifications({ order, tenant }, 'payment_confirmed')
              .then(() => sendOrderNotifications({ order, tenant }, 'order_placed'))
              .catch((err) => console.error('Failed to send webhook notifications:', err));
          }
        }

        break;
      }

      case 'charge.failed': {
        const { reference, metadata } = event.data;
        const orderId = metadata?.order_id || reference;

        await supabase
          .from('payments')
          .update({
            status: 'failed',
            provider_ref: String(event.data.id),
          })
          .eq('order_id', orderId);

        await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId);

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Paystack webhook error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

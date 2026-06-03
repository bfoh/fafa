import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/paystack/client';
import { settlePaidOrder } from '@/lib/orders/settle';

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

        // Idempotent settle (shared with the callback verification path).
        await settlePaidOrder(orderId, {
          channel,
          providerRef: String(event.data.id),
        });

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

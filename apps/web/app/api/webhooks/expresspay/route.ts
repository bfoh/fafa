import { NextResponse } from 'next/server';
import { reconcileExpressPayOrder } from '@/lib/expresspay/client';

/**
 * ExpressPay post-url webhook. ExpressPay POSTs `order-id` and `token`
 * (form-encoded) after a transaction completes. There is NO signature on the
 * callback, so the body is treated only as a trigger — the authoritative
 * status comes from re-querying ExpressPay by token inside
 * reconcileExpressPayOrder (which also guards on the amount). We must reply
 * 200 quickly per ExpressPay's contract.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let orderId = '';

    if (contentType.includes('application/json')) {
      const json = await req.json().catch(() => ({}));
      orderId = String(json['order-id'] ?? json.order_id ?? '');
    } else {
      const form = await req.formData();
      orderId = String(form.get('order-id') ?? form.get('order_id') ?? '');
    }

    if (orderId) {
      await reconcileExpressPayOrder(orderId).catch((err) =>
        console.error('ExpressPay webhook reconcile failed:', err)
      );
    }

    // Always 200 — ExpressPay retries on non-200, and settlement is idempotent.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('ExpressPay webhook error:', err);
    // Still 200: reconciliation is also covered by the tracker-poll path, and a
    // 500 would trigger ExpressPay retries against a request we can't parse.
    return NextResponse.json({ received: true });
  }
}

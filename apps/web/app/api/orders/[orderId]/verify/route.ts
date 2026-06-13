import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileExpressPayOrder } from '@/lib/expresspay/client';
import { corsHeaders, preflight } from '@/lib/http/cors';
import type {
  OrderTrackingPayload,
  VerifyResult,
} from '@/lib/storefront/payload';

/* ── Mobile order endpoint (CORS-enabled) ───────────────────
   A dedicated route so the existing /api/orders/[id] stays byte-for-byte
   untouched. Both verbs reconcile pending online payments (the same authoritative
   verify+settle the web order page did inline); the Paystack webhook remains the
   async backup. Order id is an unguessable UUID → safe for anonymous read.

     GET  → { order, history, tenant, paid }  (tracker first paint + polling)
     POST → { paid, status }                  (explicit settlement on Paystack return) */

export const dynamic = 'force-dynamic';

const ORDER_FIELDS = `
  id, order_number, status, payment_status, payment_method,
  delivery_type, delivery_address, subtotal, delivery_fee, total,
  estimated_ready_at, confirmed_at, ready_at, delivered_at,
  cancelled_at, cancellation_reason, created_at, updated_at, tenant_id,
  order_items ( id, item_name, quantity, line_total, options_json )
`;

/** Verify + settle a pending online payment. Idempotent; no-op for paid / COD.
 *  Delegates to the shared ExpressPay reconcile (token-keyed query). */
async function reconcile(
  _supabase: ReturnType<typeof createAdminClient>,
  order: { id: string; payment_status: string; payment_method: string; total: number }
): Promise<boolean> {
  if (order.payment_status === 'paid') return true;
  if (order.payment_method === 'cash_on_delivery') return false;
  if (order.payment_status !== 'pending') return false;
  return reconcileExpressPayOrder(order.id);
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { orderId } = await ctx.params;
    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404, headers }
      );
    }

    const paid = await reconcile(supabase, order as any);
    if (paid) (order as any).payment_status = 'paid';

    const { data: history } = await supabase
      .from('order_status_history')
      .select('to_status, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, phone, whatsapp, primary_color')
      .eq('id', (order as any).tenant_id)
      .single();

    const payload: OrderTrackingPayload = {
      order,
      history: (history as any) || [],
      tenant: {
        name: tenant?.name || 'this restaurant',
        phone: tenant?.phone || null,
        whatsapp: tenant?.whatsapp || null,
        primary_color: tenant?.primary_color || '#FF6B35',
      },
      paid,
    };

    return NextResponse.json(payload, { headers });
  } catch (err) {
    console.error('order tracking failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { orderId } = await ctx.params;
    const supabase = createAdminClient();

    const { data: order } = await supabase
      .from('orders')
      .select('id, payment_status, payment_method, total')
      .eq('id', orderId)
      .single();

    if (!order) {
      const result: VerifyResult = { paid: false, status: 'not_found' };
      return NextResponse.json(result, { status: 404, headers });
    }

    if (order.payment_method === 'cash_on_delivery') {
      const result: VerifyResult = { paid: false, status: 'cash_on_delivery' };
      return NextResponse.json(result, { headers });
    }

    const paid = await reconcile(supabase, order as any);
    const result: VerifyResult = {
      paid,
      status: paid ? 'paid' : 'pending',
    };
    return NextResponse.json(result, { headers });
  } catch (err) {
    console.error('order verify failed:', err);
    return NextResponse.json(
      { paid: false, status: 'pending' } satisfies VerifyResult,
      { status: 500, headers }
    );
  }
}

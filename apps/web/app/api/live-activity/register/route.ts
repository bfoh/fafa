import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

/* ── Live Activity token registration (CORS, public-by-UUID) ──
   The iOS shell starts an ActivityKit activity for an order and posts the APNs
   update token here. Keyed by the unguessable order id — same trust model as
   public order tracking. */

export const dynamic = 'force-dynamic';

const TERMINAL = ['delivered', 'cancelled'];

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { orderId, token, debug } = (await req.json()) as {
      orderId?: string;
      token?: string;
      debug?: string;
    };

    // Client-side diagnostics from the (uninspectable) native WebView. Stored
    // in the DB — Vercel log tails drop lines, so logs alone are unreliable.
    if (debug) {
      console.error('[live-activity] client debug:', orderId, debug.slice(0, 500));
      await createAdminClient()
        .from('live_activity_debug')
        .insert({ order_id: orderId ?? null, message: debug.slice(0, 500) });
      return NextResponse.json({ ok: true }, { headers });
    }

    if (!orderId || !token || !/^[a-f0-9]{32,200}$/i.test(token)) {
      return NextResponse.json(
        { error: 'orderId and hex token required' },
        { status: 400, headers }
      );
    }

    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (!order || TERMINAL.includes(order.status)) {
      return NextResponse.json({ error: 'Order not active' }, { status: 404, headers });
    }

    const { error } = await supabase
      .from('live_activities')
      .upsert({ order_id: orderId, apns_token: token }, { onConflict: 'order_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error('live activity register failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers });
  }
}

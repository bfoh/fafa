import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { userFromBearer } from '@/lib/auth/bearer';
import { corsHeaders, preflight } from '@/lib/http/cors';

/* ── Rider's active deliveries (CORS, bearer-authed) ──────────
   The mobile rider app lists orders assigned to the signed-in rider that are
   still in flight. */

export const dynamic = 'force-dynamic';

const ACTIVE = ['confirmed', 'ready', 'out_for_delivery'];

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));

  const rider = await userFromBearer(req);
  if (!rider) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  try {
    const supabase = createAdminClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, delivery_type, delivery_address, customer_name, customer_phone, total, tenant_id, created_at'
      )
      .eq('rider_id', rider.id)
      .in('status', ACTIVE)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ orders: orders || [] }, { headers });
  } catch (err) {
    console.error('rider orders failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

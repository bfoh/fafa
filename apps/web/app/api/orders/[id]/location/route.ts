import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

/* ── Latest rider location for an order (CORS, public-by-UUID) ──
   Serves the customer live map without exposing rider_locations to the anon
   key. Reads via the service role, keyed by the unguessable order_id — same
   trust model as public order tracking. The mobile map polls this. */

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { id } = await ctx.params;
    const supabase = createAdminClient();

    const { data } = await supabase
      .from('rider_locations')
      .select('latitude, longitude, bearing, recorded_at')
      .eq('order_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1);

    return NextResponse.json({ location: data?.[0] ?? null }, { headers });
  } catch (err) {
    console.error('rider location read failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

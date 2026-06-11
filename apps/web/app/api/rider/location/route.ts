import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { userFromBearer } from '@/lib/auth/bearer';
import { corsHeaders, preflight } from '@/lib/http/cors';
import { updateLiveActivity } from '@/lib/live-activity/update';

/* ── Rider GPS breadcrumb ingest (CORS, bearer-authed) ───────
   The rider app batches location fixes and posts them here. We verify the rider
   is assigned to the order before writing (service role). */

export const dynamic = 'force-dynamic';

interface RiderPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  bearing?: number | null;
  speed?: number | null;
  recordedAt: number | string; // epoch ms or ISO
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));

  const rider = await userFromBearer(req);
  if (!rider) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  try {
    const { orderId, points } = (await req.json()) as {
      orderId?: string;
      points?: RiderPoint[];
    };

    if (!orderId || !Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: 'orderId and non-empty points[] required' },
        { status: 400, headers }
      );
    }

    const supabase = createAdminClient();

    // Authorization: the rider must be the one assigned to this order.
    const { data: order } = await supabase
      .from('orders')
      .select('*, tenant:tenants(*)')
      .eq('id', orderId)
      .single();

    if (!order || order.rider_id !== rider.id) {
      return NextResponse.json(
        { error: 'Not assigned to this order' },
        { status: 403, headers }
      );
    }

    const rows = points
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => ({
        order_id: orderId,
        rider_id: rider.id,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy ?? null,
        bearing: p.bearing ?? null,
        speed: p.speed ?? null,
        recorded_at: new Date(p.recordedAt).toISOString(),
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 }, { headers });
    }

    const { error } = await supabase.from('rider_locations').insert(rows);
    if (error) throw error;

    // Lock-screen progress update from the freshest fix — fire-and-forget,
    // throttled inside updateLiveActivity.
    const latest = rows[rows.length - 1];
    if (order.tenant) {
      void updateLiveActivity({ order, tenant: order.tenant }, 'rider', {
        latitude: latest.latitude,
        longitude: latest.longitude,
        speed: latest.speed,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, inserted: rows.length }, { headers });
  } catch (err) {
    console.error('rider location ingest failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

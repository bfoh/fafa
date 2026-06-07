import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

/* ── Device token registration (CORS-enabled) ───────────────
   The mobile app posts its FCM/APNs token here after permission grant. Upsert
   by token so re-registration just refreshes last_seen + association. */

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { token, platform, customerPhone } = await req.json();

    if (!token || !['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json(
        { error: 'token and valid platform required' },
        { status: 400, headers }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('device_tokens').upsert(
      {
        token,
        platform,
        customer_phone: customerPhone ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error('device register failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

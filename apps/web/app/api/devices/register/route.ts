import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResolvedTenantId } from '@/lib/admin/guard';
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
    // Only include customer_phone when provided — omitting it on upsert
    // preserves the existing value so a plain app-launch re-registration
    // (which sends customerPhone: null) never wipes a phone linked at checkout.
    const payload: Record<string, unknown> = {
      token,
      platform,
      last_seen_at: new Date().toISOString(),
    };
    if (customerPhone) payload.customer_phone = customerPhone;

    // Restaurant owners: if the caller has an authenticated dashboard session,
    // link the device to their tenant (resolved server-side — the client can't
    // claim a tenant). Impersonating platform admins are deliberately not
    // linked. Omitted otherwise, so upsert preserves an existing link.
    try {
      const { tenantId, isImpersonating } = await getResolvedTenantId();
      if (tenantId && !isImpersonating) payload.tenant_id = tenantId;
    } catch {
      /* anonymous customer — no tenant link */
    }

    const { error } = await supabase.from('device_tokens').upsert(
      payload,
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

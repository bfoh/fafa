import { NextResponse } from 'next/server';
import { getResolvedTenantId } from '@/lib/admin/guard';
import { corsHeaders, preflight } from '@/lib/http/cors';
import { reconcileTenantPendingPayments } from '@/lib/orders/reconcile';

/** CORS preflight for the native app (capacitor:// origin). */
export function OPTIONS(req: Request) {
  return preflight(req);
}

// Restaurant-scoped payment reconciliation. The orders dashboard calls this on
// load; settled orders then surface via the realtime subscription. Auth is the
// resolved tenant (cookie session on web, Bearer token in the native app), so an
// owner/admin can only reconcile their own (or the impersonated) restaurant.
export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get('origin'));
  const { tenantId } = await getResolvedTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  try {
    const settled = await reconcileTenantPendingPayments(tenantId);
    return NextResponse.json({ settled }, { headers: cors });
  } catch (err) {
    console.error('Tenant payment reconcile failed:', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500, headers: cors });
  }
}

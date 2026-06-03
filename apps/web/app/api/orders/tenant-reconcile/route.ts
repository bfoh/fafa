import { NextResponse } from 'next/server';
import { getResolvedTenantId } from '@/lib/admin/guard';
import { reconcileTenantPendingPayments } from '@/lib/orders/reconcile';

// Restaurant-scoped payment reconciliation. The orders dashboard calls this on
// load; settled orders then surface via the realtime subscription. Auth is the
// resolved tenant (impersonation-aware), so an owner/admin can only reconcile
// their own (or the impersonated) restaurant.
export async function POST() {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settled = await reconcileTenantPendingPayments(tenantId);
    return NextResponse.json({ settled });
  } catch (err) {
    console.error('Tenant payment reconcile failed:', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}

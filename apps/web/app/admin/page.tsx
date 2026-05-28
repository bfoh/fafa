import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import AdminConsole, {
  type AdminTenant,
  type PlatformMetrics,
} from '@/components/admin/admin-console';

export const metadata = { title: 'Platform Admin' };
export const dynamic = 'force-dynamic';

export default async function PlatformAdminPage() {
  const { session, isAdmin } = await getPlatformAdmin();

  if (!session) redirect('/login?redirect=/admin');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 px-4 text-center">
        <div className="w-16 h-16 bg-error-500/10 rounded-2xl flex items-center justify-center text-error-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-surface-900">Access Denied</h1>
        <p className="text-sm text-surface-500 mt-1 max-w-sm">
          You do not have permission to view the Platform Super-Admin console.
          Please sign in with an administrator account.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // Service-role client: bypasses RLS so the admin sees every tenant + order.
  const admin = createAdminClient();

  const [{ data: tenantRows }, { data: orderRows }] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, phone, email, city, status, created_at')
      .order('created_at', { ascending: false }),
    // Minimal columns, aggregated in-app. Fine at current platform scale;
    // revisit with SQL aggregation/materialized views as order volume grows.
    admin.from('orders').select('tenant_id, total, payment_status, created_at'),
  ]);

  const orders = orderRows || [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Per-tenant rollups.
  const perTenant = new Map<string, { orders: number; revenue: number }>();
  let totalRevenue = 0;
  let ordersToday = 0;
  let revenueToday = 0;

  for (const o of orders) {
    const paid = o.payment_status === 'paid';
    const amount = Number(o.total || 0);
    const created = o.created_at ? new Date(o.created_at) : null;
    const isToday = created ? created >= startOfToday : false;

    if (o.tenant_id) {
      const agg = perTenant.get(o.tenant_id) || { orders: 0, revenue: 0 };
      agg.orders += 1;
      if (paid) agg.revenue += amount;
      perTenant.set(o.tenant_id, agg);
    }

    if (paid) totalRevenue += amount;
    if (isToday) {
      ordersToday += 1;
      if (paid) revenueToday += amount;
    }
  }

  const tenants: AdminTenant[] = (tenantRows || []).map((t) => {
    const agg = perTenant.get(t.id) || { orders: 0, revenue: 0 };
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      phone: t.phone,
      email: t.email,
      city: t.city,
      status: t.status,
      created_at: t.created_at,
      orderCount: agg.orders,
      revenue: agg.revenue,
    };
  });

  const metrics: PlatformMetrics = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.status === 'active').length,
    suspendedTenants: tenants.filter((t) => t.status === 'suspended').length,
    onboardingTenants: tenants.filter((t) => t.status === 'onboarding').length,
    totalOrders: orders.length,
    totalRevenue,
    ordersToday,
    revenueToday,
  };

  return <AdminConsole tenants={tenants} metrics={metrics} />;
}

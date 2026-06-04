import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  DollarSign,
  Users,
  UtensilsCrossed,
  ExternalLink,
  CreditCard,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatGHS } from '@/lib/utils/currency';
import { formatDate, timeAgo } from '@/lib/utils';
import TenantStatusControl from '@/components/admin/tenant-status-control';

export const metadata = { title: 'Tenant Detail' };
export const dynamic = 'force-dynamic';

type TenantStatus = 'onboarding' | 'active' | 'suspended' | 'deactivated';

const statusStyles: Record<TenantStatus, string> = {
  active: 'bg-success-500/10 text-success-700',
  suspended: 'bg-error-500/10 text-error-700',
  onboarding: 'bg-warning-500/10 text-warning-700',
  deactivated: 'bg-surface-200 text-surface-600',
};

const orderStatusStyles: Record<string, string> = {
  pending: 'bg-warning-500/10 text-warning-700',
  confirmed: 'bg-info-500/10 text-info-700',
  preparing: 'bg-info-500/10 text-info-700',
  ready: 'bg-brand-500/10 text-brand-700',
  out_for_delivery: 'bg-brand-500/10 text-brand-700',
  delivered: 'bg-success-500/10 text-success-700',
  cancelled: 'bg-error-500/10 text-error-700',
};

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, isAdmin } = await getPlatformAdmin();

  if (!session) redirect(`/login?redirect=/admin/tenants/${id}`);
  if (!isAdmin) redirect('/dashboard');

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (!tenant) notFound();

  const [
    { data: recentOrders },
    { data: aggOrders },
    { count: customerCount },
    { count: menuCount },
    { data: memberRows },
  ] = await Promise.all([
    admin
      .from('orders')
      .select(
        'id, order_number, customer_name, total, status, payment_status, created_at'
      )
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('orders').select('total, payment_status').eq('tenant_id', id),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id),
    admin
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id),
    admin
      .from('tenant_members')
      .select('user_id, role, created_at')
      .eq('tenant_id', id),
  ]);

  const orders = aggOrders || [];
  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Resolve member emails via the auth admin API (member counts are small).
  const members = await Promise.all(
    (memberRows || []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return {
        userId: m.user_id,
        role: m.role as string,
        createdAt: m.created_at as string,
        email: data.user?.email ?? null,
      };
    })
  );

  const status = tenant.status as TenantStatus;

  const metrics = [
    {
      label: 'Total Orders',
      value: totalOrders.toString(),
      icon: ShoppingBag,
      color: 'text-brand-600',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Revenue (paid)',
      value: formatGHS(totalRevenue),
      icon: DollarSign,
      color: 'text-success-600',
      bg: 'bg-success-500/10',
    },
    {
      label: 'Customers',
      value: (customerCount || 0).toString(),
      icon: Users,
      color: 'text-info-600',
      bg: 'bg-info-500/10',
    },
    {
      label: 'Menu Items',
      value: (menuCount || 0).toString(),
      icon: UtensilsCrossed,
      color: 'text-warning-600',
      bg: 'bg-warning-500/10',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-canvas p-6 sm:p-10 space-y-8">
      {/* Back */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-surface-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to all tenants
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-150 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {tenant.name}
            </h1>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyles[status]}`}
            >
              {status}
            </span>
          </div>
          <a
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-brand-600 mt-1"
          >
            /{tenant.slug} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <TenantStatusControl tenantId={tenant.id} status={status} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white rounded-2xl p-5 border border-hairline shadow-sm flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${m.bg} ${m.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-surface-500">
                  {m.label}
                </p>
                <p className="text-xl font-bold text-surface-950 mt-0.5 truncate">
                  {m.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl border border-hairline shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-surface-900">Profile</h2>
          <dl className="space-y-3 text-xs">
            {tenant.description && (
              <div>
                <dt className="text-surface-400 font-semibold">Description</dt>
                <dd className="text-surface-800 mt-0.5">
                  {tenant.description}
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2 text-surface-700">
              <Phone className="w-3.5 h-3.5 text-surface-400" />
              {tenant.phone}
            </div>
            {tenant.email && (
              <div className="flex items-center gap-2 text-surface-700">
                <Mail className="w-3.5 h-3.5 text-surface-400" />
                {tenant.email}
              </div>
            )}
            <div className="flex items-center gap-2 text-surface-700">
              <MapPin className="w-3.5 h-3.5 text-surface-400" />
              {[tenant.address, tenant.city, tenant.region]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
            <div>
              <dt className="text-surface-400 font-semibold">Joined</dt>
              <dd className="text-surface-800 mt-0.5">
                {formatDate(tenant.created_at)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Business config */}
        <div className="bg-white rounded-2xl border border-hairline shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-surface-900">Business</h2>
          <dl className="space-y-2 text-xs">
            <Row label="Delivery fee" value={formatGHS(Number(tenant.delivery_fee || 0))} />
            <Row
              label="Min order"
              value={formatGHS(Number(tenant.min_order_amount || 0))}
            />
            <Row label="Delivery" value={tenant.accepts_delivery ? 'Yes' : 'No'} />
            <Row label="Pickup" value={tenant.accepts_pickup ? 'Yes' : 'No'} />
            <Row
              label="Pay online"
              value={tenant.accepts_pay_online ? 'Yes' : 'No'}
            />
            <Row
              label="Pay on delivery"
              value={tenant.accepts_pay_on_delivery ? 'Yes' : 'No'}
            />
          </dl>
        </div>

        {/* Payment + Team */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-hairline shadow-sm p-6 space-y-3">
            <h2 className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-surface-400" /> Payments
            </h2>
            {tenant.paystack_subaccount_code ? (
              <div className="text-xs">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-success-500/10 text-success-700">
                  Connected
                </span>
                <p className="font-mono text-[10px] text-surface-500 mt-2 break-all">
                  {tenant.paystack_subaccount_code}
                </p>
              </div>
            ) : (
              <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-warning-500/10 text-warning-700">
                Not connected
              </span>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-hairline shadow-sm p-6 space-y-3">
            <h2 className="text-sm font-bold text-surface-900">
              Team ({members.length})
            </h2>
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-xs text-surface-400 italic">No members.</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-surface-800 truncate">
                      {m.email || m.userId.slice(0, 8)}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">
                      {m.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-surface-900">Recent Orders</h2>
        <div className="bg-white rounded-2xl border border-hairline shadow-sm overflow-hidden text-xs">
          {!recentOrders || recentOrders.length === 0 ? (
            <div className="py-12 text-center text-surface-400 italic">
              No orders yet.
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-surface-100">
              {recentOrders.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900">{o.customer_name}</p>
                      <p className="font-mono text-[10px] text-surface-500">{o.order_number}</p>
                    </div>
                    <p className="font-bold shrink-0">{formatGHS(Number(o.total))}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${o.payment_status === 'paid' ? 'bg-success-500/10 text-success-700' : 'bg-surface-200 text-surface-600'}`}>
                      {o.payment_status}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${orderStatusStyles[o.status] || 'bg-surface-200 text-surface-600'}`}>
                      {o.status}
                    </span>
                    <span className="text-[10px] text-surface-400 ml-auto">{timeAgo(o.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-100 border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase select-none">
                    <th className="p-4">Order</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Payment</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-50/50">
                      <td className="p-4 font-mono text-[10px] text-surface-600">
                        {o.order_number}
                      </td>
                      <td className="p-4 font-semibold text-surface-900">
                        {o.customer_name}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {formatGHS(Number(o.total))}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            o.payment_status === 'paid'
                              ? 'bg-success-500/10 text-success-700'
                              : 'bg-surface-200 text-surface-600'
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            orderStatusStyles[o.status] ||
                            'bg-surface-200 text-surface-600'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4 text-right text-surface-500">
                        {timeAgo(o.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-surface-400 font-semibold">{label}</dt>
      <dd className="text-surface-800 font-medium">{value}</dd>
    </div>
  );
}

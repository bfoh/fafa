import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatGHS } from '@/lib/utils/currency';
import { timeAgo } from '@/lib/utils';
import {
  ShoppingBag,
  DollarSign,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard',
};

export const dynamic = 'force-dynamic';


export default async function DashboardPage() {
  let totalOrders = 0;
  let revenue = 0;
  let pendingCount = 0;
  let recentOrders: any[] = [];
  const stats: any[] = [];

  try {
    const supabase = await createServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) redirect('/login');

    // Get tenant_id
    const { data: member } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member) redirect('/register');

    const tenantId = member.tenant_id;
    const today = new Date().toISOString().split('T')[0];

    // Fetch today's stats
    const [ordersResult, revenueResult, pendingResult, recentResult] =
      await Promise.all([
        // Total orders today
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', `${today}T00:00:00`),

        // Revenue today
        supabase
          .from('orders')
          .select('total')
          .eq('tenant_id', tenantId)
          .eq('payment_status', 'paid')
          .gte('created_at', `${today}T00:00:00`),

        // Pending orders
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'confirmed', 'preparing']),

        // Recent orders
        supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

    totalOrders = ordersResult.count || 0;
    revenue = (revenueResult.data || []).reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    pendingCount = pendingResult.count || 0;
    recentOrders = recentResult.data || [];

    stats.push(
      {
        label: 'Orders Today',
        value: totalOrders.toString(),
        icon: ShoppingBag,
        color: 'text-brand-500',
        bg: 'bg-brand-500/10',
      },
      {
        label: 'Revenue Today',
        value: formatGHS(revenue),
        icon: DollarSign,
        color: 'text-success-600',
        bg: 'bg-success-500/10',
      },
      {
        label: 'Pending',
        value: pendingCount.toString(),
        icon: Clock,
        color: 'text-warning-600',
        bg: 'bg-warning-500/10',
      },
      {
        label: 'Avg. Order',
        value: totalOrders > 0 ? formatGHS(revenue / totalOrders) : '—',
        icon: TrendingUp,
        color: 'text-info-600',
        bg: 'bg-info-500/10',
      }
    );
  } catch (err) {
    // Rethrow Next.js internal redirect and dynamic server errors so Next.js handles them properly
    if (
      err instanceof Error &&
      (err.message.includes('NEXT_REDIRECT') ||
        (err as any).digest?.startsWith('NEXT_REDIRECT') ||
        (err as any).digest === 'DYNAMIC_SERVER_USAGE')
    ) {
      throw err;
    }

    console.error('Fatal Dashboard rendering error:', err);
    return (
      <div className="p-6 bg-error-500/10 rounded-2xl border border-error-500/20 text-error-600 text-sm">
        <h2 className="text-base font-bold text-error-700">Failed to load Dashboard</h2>
        <p className="mt-1">
          {err instanceof Error ? err.message : 'An unexpected error occurred.'}
        </p>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; class: string }> = {
    pending: { label: 'Pending', class: 'badge-pending' },
    confirmed: { label: 'Confirmed', class: 'badge-confirmed' },
    preparing: { label: 'Preparing', class: 'badge-preparing' },
    ready: { label: 'Ready', class: 'badge-ready' },
    out_for_delivery: { label: 'On the way', class: 'badge-out_for_delivery' },
    delivered: { label: 'Delivered', class: 'badge-delivered' },
    cancelled: { label: 'Cancelled', class: 'badge-cancelled' },
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Today&apos;s Overview
        </h1>
        <p className="text-surface-500 mt-1">
          {new Date().toLocaleDateString('en-GH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 border border-surface-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {stat.value}
              </p>
              <p className="text-sm text-surface-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-surface-900">
            Recent Orders
          </h2>
          <Link
            href="/orders"
            className="text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-surface-500 font-medium">No orders yet</p>
            <p className="text-sm text-surface-400 mt-1">
              Share your link or QR code to start receiving orders
            </p>
            <Link
              href="/share"
              className="inline-block mt-4 px-5 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Get your QR Code
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {recentOrders.map((order) => {
              const status = statusConfig[order.status] || {
                label: order.status,
                class: '',
              };
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-brand-600">
                        {order.order_number?.replace('FA-', '#')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-surface-900 group-hover:text-brand-600 transition-colors">
                        {order.customer_name}
                      </p>
                      <p className="text-sm text-surface-400">
                        {formatGHS(Number(order.total))} ·{' '}
                        {timeAgo(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${status.class}`}
                  >
                    {status.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

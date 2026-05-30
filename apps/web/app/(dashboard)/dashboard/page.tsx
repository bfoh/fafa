import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatGHS } from '@/lib/utils/currency';
import { timeAgo } from '@/lib/utils';
import {
  ShoppingBag,
  DollarSign,
  Clock,
  TrendingUp,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import SetupChecklist from '@/components/dashboard/setup-checklist';
import { getResolvedTenantId } from '@/lib/admin/guard';

export const metadata = {
  title: 'Dashboard',
};

export const dynamic = 'force-dynamic';


export default async function DashboardPage() {
  let totalOrders = 0;
  let revenue = 0;
  let pendingCount = 0;
  let recentOrders: any[] = [];
  let recentReviews: any[] = [];
  let ratingAvg = 0;
  let ratingCount = 0;
  const stats: any[] = [];
  let setup: {
    tenantId: string;
    slug: string;
    menuDone: boolean;
    paymentsDone: boolean;
    brandingDone: boolean;
    shareDone: boolean;
  } | null = null;

  try {
    const supabase = await createServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) redirect('/login');

    const { tenantId, isPlatformAdmin } = await getResolvedTenantId();

    if (!tenantId) {
      if (isPlatformAdmin) {
        redirect('/admin');
      } else {
        redirect('/register');
      }
    }

    // Get setup-relevant tenant fields directly
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug, paystack_subaccount_code, logo_url, rating_avg, rating_count')
      .eq('id', tenantId)
      .single();

    const today = new Date().toISOString().split('T')[0];

    // Fetch today's stats
    const [
      ordersResult,
      revenueResult,
      pendingResult,
      recentResult,
      menuCountResult,
      allOrdersResult,
      reviewsResult,
    ] = await Promise.all([
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

        // Menu items count (setup checklist)
        supabase
          .from('menu_items')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // All-time orders count (setup checklist)
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // Recent reviews
        supabase
          .from('reviews')
          .select('id, rating, comment, customer_name, owner_reply, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

    setup = {
      tenantId,
      slug: tenant?.slug || '',
      menuDone: (menuCountResult.count || 0) > 0,
      paymentsDone: !!tenant?.paystack_subaccount_code,
      brandingDone: !!tenant?.logo_url,
      shareDone: (allOrdersResult.count || 0) > 0,
    };

    totalOrders = ordersResult.count || 0;
    revenue = (revenueResult.data || []).reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    pendingCount = pendingResult.count || 0;
    recentOrders = recentResult.data || [];
    recentReviews = reviewsResult.data || [];
    ratingAvg = Number(tenant?.rating_avg) || 0;
    ratingCount = Number(tenant?.rating_count) || 0;

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

      {/* Setup checklist (hides itself once the store is fully live) */}
      {setup && setup.slug && <SetupChecklist {...setup} />}

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

      {/* Reviews */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
            Customer Reviews
            {ratingCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {ratingAvg.toFixed(1)}
                <span className="text-surface-400 font-normal">({ratingCount})</span>
              </span>
            )}
          </h2>
        </div>

        {recentReviews.length === 0 ? (
          <div className="p-10 text-center">
            <Star className="w-10 h-10 text-surface-200 mx-auto mb-2" />
            <p className="text-surface-500 font-medium">No reviews yet</p>
            <p className="text-sm text-surface-400 mt-1">Reviews appear after customers rate a delivered order.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {recentReviews.map((rev) => (
              <div key={rev.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className="w-3.5 h-3.5"
                        style={{ color: n <= rev.rating ? '#F59E0B' : 'var(--color-surface-300)' }}
                        fill={n <= rev.rating ? '#F59E0B' : 'none'}
                      />
                    ))}
                    <span className="ml-1.5 text-xs font-semibold text-surface-600">{rev.customer_name || 'Customer'}</span>
                  </div>
                  <span className="text-[11px] text-surface-400">{timeAgo(rev.created_at)}</span>
                </div>
                {rev.comment && <p className="text-sm text-surface-600 mt-1.5">{rev.comment}</p>}
                {rev.owner_reply && (
                  <p className="text-xs text-surface-500 mt-1.5 pl-3 border-l-2 border-brand-200">
                    <span className="font-bold text-brand-600">You replied: </span>{rev.owner_reply}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  DollarSign,
  Clock,
  TrendingUp,
  Star,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { formatGHS } from '@fafa/storefront';
import { createMobileSupabaseClient } from '../../lib/supabase';
import { timeAgo } from '@/lib/utils';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';
import { VISIBLE_ORDER_FILTER } from '@/lib/orders/visibility';

interface OrderRow {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  total?: number | null;
  status?: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-500/10 text-warning-600',
  confirmed: 'bg-info-500/10 text-info-600',
  preparing: 'bg-brand-500/10 text-brand-600',
  ready: 'bg-success-500/10 text-success-600',
  delivered: 'bg-surface-100 text-surface-500',
  cancelled: 'bg-error-500/10 text-error-600',
};

export default function MobileDashboardHome() {
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [pending, setPending] = useState(0);
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [rating, setRating] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createMobileSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const tenantId = await getResolvedTenantIdClient(supabase, session);
      if (!tenantId) return;

      const today = new Date().toISOString().split('T')[0];

      const [ordersRes, revenueRes, pendingRes, recentRes, tenantRes] =
        await Promise.all([
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .or(VISIBLE_ORDER_FILTER)
            .gte('created_at', `${today}T00:00:00`),
          supabase
            .from('orders')
            .select('total')
            .eq('tenant_id', tenantId)
            .eq('payment_status', 'paid')
            .gte('created_at', `${today}T00:00:00`),
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .or(VISIBLE_ORDER_FILTER)
            .in('status', ['pending', 'confirmed', 'preparing']),
          supabase
            .from('orders')
            .select('id, order_number, customer_name, total, status, created_at')
            .eq('tenant_id', tenantId)
            .or(VISIBLE_ORDER_FILTER)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('tenants')
            .select('rating_avg, rating_count')
            .eq('id', tenantId)
            .single(),
        ]);

      if (!active) return;

      const rev = (revenueRes.data || []).reduce(
        (sum, o) => sum + Number(o.total || 0),
        0
      );
      setTotalOrders(ordersRes.count || 0);
      setRevenue(rev);
      setPending(pendingRes.count || 0);
      setRecent((recentRes.data as OrderRow[]) || []);
      setRating({
        avg: Number(tenantRes.data?.rating_avg) || 0,
        count: Number(tenantRes.data?.rating_count) || 0,
      });
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: 'Orders Today', value: String(totalOrders), icon: ShoppingBag, color: 'text-brand-500', bg: 'bg-brand-500/10' },
    { label: 'Revenue Today', value: formatGHS(revenue), icon: DollarSign, color: 'text-success-600', bg: 'bg-success-500/10' },
    { label: 'Pending', value: String(pending), icon: Clock, color: 'text-warning-600', bg: 'bg-warning-500/10' },
    { label: 'Avg. Order', value: totalOrders > 0 ? formatGHS(revenue / totalOrders) : '—', icon: TrendingUp, color: 'text-info-600', bg: 'bg-info-500/10' },
  ];

  if (loading) {
    return (
      <div className="py-20 grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-surface-900">Today</h1>
        <p className="text-sm text-surface-500 mt-0.5">Your kitchen at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl bg-white border border-hairline p-4 shadow-card">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-[18px] h-[18px] ${s.color}`} />
              </div>
              <div className="text-xl font-extrabold text-surface-900">{s.value}</div>
              <div className="text-xs font-medium text-surface-500 mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Rating */}
      {rating.count > 0 && (
        <div className="rounded-2xl bg-white border border-hairline p-4 shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-warning-500/10 flex items-center justify-center">
            <Star className="w-[18px] h-[18px] text-warning-600" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-surface-900">
              {rating.avg.toFixed(1)}
              <span className="text-sm font-medium text-surface-400"> / 5</span>
            </div>
            <div className="text-xs font-medium text-surface-500">{rating.count} reviews</div>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="rounded-2xl bg-white border border-hairline shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <h2 className="text-sm font-bold text-surface-900">Recent orders</h2>
          <Link href="/orders" className="text-xs font-semibold text-brand-600 flex items-center gap-0.5">
            All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-surface-400">No orders yet today.</div>
        ) : (
          <ul className="divide-y divide-hairline">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href="/orders" className="flex items-center gap-3 px-4 py-3 active:bg-surface-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-surface-900 truncate">
                      {o.customer_name || 'Customer'}
                    </div>
                    <div className="text-xs text-surface-400">
                      #{o.order_number || o.id.slice(0, 6)} · {timeAgo(o.created_at)}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg capitalize ${STATUS_STYLES[o.status || ''] || 'bg-surface-100 text-surface-500'}`}>
                    {o.status || '—'}
                  </span>
                  <div className="text-sm font-bold text-surface-900 tabular-nums">
                    {formatGHS(Number(o.total || 0))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

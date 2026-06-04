'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatGHS } from '@/lib/utils/currency';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Percent,
  Calendar,
  Loader2,
  Utensils,
  CreditCard,
  Smartphone,
  Banknote,
  Award,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';
import { isPaidOrder } from '@/lib/orders/revenue';

interface OrderItem {
  id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface Order {
  id: string;
  status: string;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export default function AnalyticsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [popularItems, setPopularItems] = useState<{ name: string; quantity: number; revenue: number }[]>([]);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          setTenantId(tId);

          // 1. Fetch all orders (excluding cancelled)
          const { data: fetchedOrders, error: ordersErr } = await supabase
            .from('orders')
            .select('id, status, total, payment_method, payment_status, created_at')
            .eq('tenant_id', tId)
            .neq('status', 'cancelled');

          if (!ordersErr && fetchedOrders) {
            const formatted = fetchedOrders.map((o) => ({
              ...o,
              total: Number(o.total),
            }));
            setOrders(formatted);
          }

          // 2. Fetch order items to compute popular dishes
          const { data: fetchedItems, error: itemsErr } = await supabase
            .from('order_items')
            .select('item_name, unit_price, quantity, line_total, orders!inner(tenant_id, status)')
            .eq('orders.tenant_id', tId)
            .neq('orders.status', 'cancelled');

          if (!itemsErr && fetchedItems) {
            // Process popular items
            const itemCounts: Record<string, { quantity: number; revenue: number }> = {};
            fetchedItems.forEach((i: any) => {
              const name = i.item_name;
              const qty = Number(i.quantity);
              const total = Number(i.line_total);
              if (!itemCounts[name]) {
                itemCounts[name] = { quantity: 0, revenue: 0 };
              }
              itemCounts[name].quantity += qty;
              itemCounts[name].revenue += total;
            });

            const popular = Object.keys(itemCounts).map((name) => ({
              name,
              quantity: itemCounts[name].quantity,
              revenue: itemCounts[name].revenue,
            })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

            setPopularItems(popular);
          }
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  // Compute stats
  const totalRevenue = orders
    .filter(isPaidOrder)
    .reduce((sum, o) => sum + o.total, 0);

  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Compute payment splits
  const paymentSplits = orders.reduce(
    (acc, o) => {
      if (o.payment_method === 'momo') acc.momo += 1;
      else if (o.payment_method === 'card') acc.card += 1;
      else if (o.payment_method === 'cash_on_delivery') acc.cash += 1;
      return acc;
    },
    { momo: 0, card: 0, cash: 0 }
  );

  const totalPayments = paymentSplits.momo + paymentSplits.card + paymentSplits.cash || 1;
  const splitsPct = {
    momo: Math.round((paymentSplits.momo / totalPayments) * 100),
    card: Math.round((paymentSplits.card / totalPayments) * 100),
    cash: Math.round((paymentSplits.cash / totalPayments) * 100),
  };

  // Compute 7-day trend (last 7 days including today)
  const getTrendData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayOrders = orders.filter((o) => o.created_at.startsWith(dateStr));
      const daySales = dayOrders
        .filter(isPaidOrder)
        .reduce((sum, o) => sum + o.total, 0);

      data.push({
        label: date.toLocaleDateString('en-GH', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }),
        sales: daySales,
        count: dayOrders.length,
      });
    }
    return data;
  };

  const trendData = getTrendData();
  const maxSalesInTrend = Math.max(...trendData.map((d) => d.sales)) || 1;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs text-surface-500 mt-2">Generating analytics report...</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6 text-center">
        <p className="text-surface-500 font-medium">No restaurant found for this account.</p>
        <p className="text-sm text-surface-400 mt-1">Please ensure you have onboarded or created a restaurant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-500" />
          Sales & Analytics
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Monitor your restaurant&apos;s financial health, payment methods, and most popular menu items.
        </p>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sales Revenue',
            value: formatGHS(totalRevenue),
            icon: DollarSign,
            color: 'text-success-600',
            bg: 'bg-success-500/10',
            desc: 'Paid + Completed orders',
          },
          {
            label: 'Total Orders Accepted',
            value: totalOrders.toString(),
            icon: ShoppingBag,
            color: 'text-brand-500',
            bg: 'bg-brand-500/10',
            desc: 'Excluding cancelled',
          },
          {
            label: 'Average Order Value',
            value: formatGHS(averageOrderValue),
            icon: TrendingUp,
            color: 'text-info-600',
            bg: 'bg-info-500/10',
            desc: 'Average ticket size',
          },
          {
            label: 'Most Popular Choice',
            value: popularItems[0]?.name || '—',
            icon: Award,
            color: 'text-warning-600',
            bg: 'bg-warning-500/10',
            desc: popularItems[0] ? `${popularItems[0].quantity} orders placed` : 'No data yet',
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl p-5 border border-hairline shadow-card flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${kpi.bg}`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-surface-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-surface-950 mt-1 truncate">{kpi.value}</p>
                <p className="text-[10px] text-surface-400 mt-1.5">{kpi.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Trend Bar Chart (CSS-based) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-100 p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-surface-900">7-Day Sales Performance</h2>
            <p className="text-xs text-surface-400 mt-0.5">Daily sales revenue over the last week.</p>
          </div>

          <div className="h-60 flex items-end justify-between pt-6 border-b border-surface-150 pb-2 gap-2">
            {trendData.map((d, index) => {
              const heightPct = Math.round((d.sales / maxSalesInTrend) * 100) || 5;
              return (
                <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 bg-surface-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 text-center shadow-lg">
                    <p>{d.dateLabel}</p>
                    <p className="text-brand-400 font-extrabold">{formatGHS(d.sales)}</p>
                    <p className="text-[9px] font-normal text-surface-300">{d.count} orders</p>
                  </div>

                  {/* Vertical bar */}
                  <div
                    className="w-full sm:w-10 bg-brand-500 rounded-t-xl transition-all group-hover:bg-brand-600 cursor-pointer relative"
                    style={{ height: `${heightPct}%` }}
                  >
                    {d.sales > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {Math.round(d.sales)}
                      </span>
                    )}
                  </div>

                  {/* Date label */}
                  <span className="text-[10px] text-surface-500 font-semibold mt-2 shrink-0">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods Breakdowns */}
        <div className="bg-white rounded-2xl border border-surface-100 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-surface-900">Payment Channels</h2>
            <p className="text-xs text-surface-400 mt-0.5">Which methods your customers prefer at checkout.</p>
          </div>

          <div className="space-y-4 py-2">
            {[
              {
                label: 'Mobile Money',
                icon: Smartphone,
                count: paymentSplits.momo,
                pct: splitsPct.momo,
                color: 'bg-yellow-500',
                text: 'text-yellow-600',
              },
              {
                label: 'Card (Paystack)',
                icon: CreditCard,
                count: paymentSplits.card,
                pct: splitsPct.card,
                color: 'bg-brand-500',
                text: 'text-brand-500',
              },
              {
                label: 'Pay on Delivery',
                icon: Banknote,
                count: paymentSplits.cash,
                pct: splitsPct.cash,
                color: 'bg-success-500',
                text: 'text-success-600',
              },
            ].map((method) => {
              const Icon = method.icon;
              return (
                <div key={method.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-surface-700">
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-surface-400" />
                      {method.label}
                    </span>
                    <span>
                      {method.count} ({method.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-100 rounded-full overflow-hidden">
                    <div className={`h-full ${method.color} rounded-full`} style={{ width: `${method.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-surface-400 italic text-center">
            Momo and Cards settle directly via Paystack gateway.
          </p>
        </div>
      </div>

      {/* Popular Dishes table */}
      <div className="bg-white rounded-2xl border border-surface-100 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-surface-900">Most Popular Dishes</h2>
          <p className="text-xs text-surface-400 mt-0.5">Your top-selling menu items by orders count.</p>
        </div>

        {popularItems.length === 0 ? (
          <div className="py-10 text-center">
            <Utensils className="w-10 h-10 text-surface-300 mx-auto mb-2" />
            <p className="text-xs text-surface-500 font-medium">No order items recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {popularItems.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-600 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-surface-900">{item.name}</p>
                    <p className="text-[10px] text-surface-400">Total sold: {item.quantity} units</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-surface-900">{formatGHS(item.revenue)}</p>
                  <p className="text-[9px] text-surface-400">Gross revenue</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

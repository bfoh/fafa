'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatGHS } from '@/lib/utils/currency';
import { formatDateTime } from '@/lib/utils';
import {
  CreditCard,
  Smartphone,
  Banknote,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  Search,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

interface Payment {
  id: string;
  amount: number;
  method: 'card' | 'momo' | 'cash';
  provider: 'paystack' | 'manual';
  provider_ref: string | null;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  created_at: string;
  orders: {
    order_number: string;
    customer_name: string;
  } | null;
}

export default function PaymentsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'success' | 'pending' | 'failed'>('all');

  useEffect(() => {
    async function loadPayments() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          setTenantId(tId);

          const { data, error } = await supabase
            .from('payments')
            .select(`
              id,
              amount,
              method,
              provider,
              provider_ref,
              status,
              created_at,
              orders (
                order_number,
                customer_name
              )
            `)
            .eq('tenant_id', tId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) {
            setPayments(data as unknown as Payment[]);
          }
        }
      } catch (err) {
        console.error('Failed to load payments history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  // Compute Volume Summaries
  const successfulPayments = payments.filter((p) => p.status === 'success');
  
  const totalVolume = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const momoVolume = successfulPayments
    .filter((p) => p.method === 'momo')
    .reduce((sum, p) => sum + Number(p.amount), 0);
    
  const cardVolume = successfulPayments
    .filter((p) => p.method === 'card')
    .reduce((sum, p) => sum + Number(p.amount), 0);
    
  const cashVolume = successfulPayments
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Filter Payments list
  const filteredPayments = payments.filter((p) => {
    // Tab filtering
    if (activeTab === 'success' && p.status !== 'success') return false;
    if (activeTab === 'pending' && p.status !== 'pending') return false;
    if (activeTab === 'failed' && p.status !== 'failed' && p.status !== 'refunded') return false;

    // Search query filtering (by Order Number, Customer Name, or Ref)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const orderNum = p.orders?.order_number?.toLowerCase() || '';
      const customer = p.orders?.customer_name?.toLowerCase() || '';
      const ref = p.provider_ref?.toLowerCase() || '';
      return orderNum.includes(query) || customer.includes(query) || ref.includes(query);
    }

    return true;
  });

  const methodConfig = {
    momo: { label: 'Mobile Money', icon: Smartphone, bg: 'bg-yellow-500/10 text-yellow-600' },
    card: { label: 'Card Payment', icon: CreditCard, bg: 'bg-brand-500/10 text-brand-600' },
    cash: { label: 'Pay on Delivery', icon: Banknote, bg: 'bg-success-500/10 text-success-600' },
  };

  const statusConfig = {
    pending: { label: 'Pending', class: 'bg-warning-500/10 text-warning-600', icon: AlertCircle },
    success: { label: 'Success', class: 'bg-success-500/10 text-success-600', icon: CheckCircle2 },
    failed: { label: 'Failed', class: 'bg-error-500/10 text-error-600', icon: XCircle },
    refunded: { label: 'Refunded', class: 'bg-surface-200 text-surface-600', icon: AlertCircle },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs text-surface-500 mt-2">Loading transactions...</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6 text-center max-w-lg mx-auto">
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
          <CreditCard className="w-6 h-6 text-brand-500" />
          Payments & Transactions
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Monitor your payouts, Mobile Money collections, card transactions, and cash receipts.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Volume Settle',
            value: formatGHS(totalVolume),
            icon: DollarSign,
            color: 'text-success-600',
            bg: 'bg-success-500/10',
            desc: 'Completed sales receipts',
          },
          {
            label: 'Mobile Money Volume',
            value: formatGHS(momoVolume),
            icon: Smartphone,
            color: 'text-yellow-600',
            bg: 'bg-yellow-500/10',
            desc: 'MoMo gateway settlements',
          },
          {
            label: 'Card Payments (Paystack)',
            value: formatGHS(cardVolume),
            icon: CreditCard,
            color: 'text-brand-500',
            bg: 'bg-brand-500/10',
            desc: 'Direct card collections',
          },
          {
            label: 'Cash on Delivery Volume',
            value: formatGHS(cashVolume),
            icon: Banknote,
            color: 'text-info-600',
            bg: 'bg-info-500/10',
            desc: 'Collected locally by riders',
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl p-5 border border-surface-100 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${kpi.bg}`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-surface-500">{kpi.label}</p>
                <p className="text-xl font-bold text-surface-950 mt-1 truncate">{kpi.value}</p>
                <p className="text-[9px] text-surface-400 mt-1">{kpi.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transactions Search and Tabs */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-surface-50/50">
          {/* Tabs */}
          <div className="flex gap-1.5 p-1 bg-surface-200/50 rounded-xl w-full md:w-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'success', label: 'Success' },
              { id: 'pending', label: 'Pending' },
              { id: 'failed', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Field */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search order or ref number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-250 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
            />
          </div>
        </div>

        {/* Payments Table */}
        {filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-surface-400 italic">
            <CreditCard className="w-10 h-10 text-surface-200 mx-auto mb-2" />
            No transactions found matching your filters.
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-surface-100">
            {filteredPayments.map((payment) => {
              const method = methodConfig[payment.method] || { label: payment.method, icon: CreditCard, bg: 'bg-surface-100 text-surface-600' };
              const MethodIcon = method.icon;
              const status = statusConfig[payment.status] || { label: payment.status, class: 'bg-surface-100 text-surface-600', icon: AlertCircle };
              const StatusIcon = status.icon;
              return (
                <div key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-surface-900 text-sm">
                        {payment.orders?.order_number || '—'}
                      </p>
                      <p className="text-xs text-surface-500 truncate">
                        {payment.orders?.customer_name || 'Guest'}
                      </p>
                    </div>
                    <p className="font-extrabold text-sm text-surface-900 shrink-0">
                      {formatGHS(Number(payment.amount))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${method.bg}`}>
                      <MethodIcon className="w-3.5 h-3.5" />
                      {method.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.class}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                    <span className="text-[10px] text-surface-400 ml-auto">
                      {formatDateTime(payment.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-surface-700">
              <thead className="bg-surface-50 text-[10px] font-bold text-surface-500 uppercase border-b border-surface-150">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Reference / ID</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredPayments.map((payment) => {
                  const method = methodConfig[payment.method] || { label: payment.method, icon: CreditCard, bg: 'bg-surface-100 text-surface-600' };
                  const MethodIcon = method.icon;
                  const status = statusConfig[payment.status] || { label: payment.status, class: 'bg-surface-100 text-surface-600', icon: AlertCircle };
                  const StatusIcon = status.icon;

                  return (
                    <tr key={payment.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-surface-900">
                        {payment.orders?.order_number || '—'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-surface-850">
                        {payment.orders?.customer_name || 'Guest'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${method.bg}`}>
                          <MethodIcon className="w-3.5 h-3.5" />
                          {method.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-surface-450 truncate max-w-[150px]">
                        {payment.provider_ref || 'Local transaction'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.class}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-surface-900 text-right pr-12">
                        {formatGHS(Number(payment.amount))}
                      </td>
                      <td className="px-6 py-4 text-surface-400 whitespace-nowrap">
                        {formatDateTime(payment.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

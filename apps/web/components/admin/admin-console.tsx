'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Building2,
  AlertTriangle,
  Check,
  Search,
  ShoppingBag,
  DollarSign,
  Clock,
  Hourglass,
  Download,
} from 'lucide-react';
import { formatGHS } from '@/lib/utils/currency';

export type TenantStatus =
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'deactivated';

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  city: string | null;
  status: TenantStatus;
  created_at: string;
  orderCount: number;
  revenue: number;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  onboardingTenants: number;
  totalOrders: number;
  totalRevenue: number;
  ordersToday: number;
  revenueToday: number;
}

const statusStyles: Record<TenantStatus, string> = {
  active: 'bg-success-500/10 text-success-700',
  suspended: 'bg-error-500/10 text-error-700',
  onboarding: 'bg-warning-500/10 text-warning-700',
  deactivated: 'bg-surface-200 text-surface-600',
};

export default function AdminConsole({
  tenants: initialTenants,
  metrics,
}: {
  tenants: AdminTenant[];
  metrics: PlatformMetrics;
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleToggleStatus(
    tenantId: string,
    currentStatus: TenantStatus
  ) {
    const nextStatus: TenantStatus =
      currentStatus === 'active' ? 'suspended' : 'active';
    setActionLoading(tenantId);

    // Optimistic update; revert on failure.
    const prev = tenants;
    setTenants((list) =>
      list.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t))
    );

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Update failed');
      }
    } catch (err) {
      setTenants(prev);
      alert(
        err instanceof Error
          ? `Failed to update tenant: ${err.message}`
          : 'Failed to update tenant status.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  function exportCsv() {
    const headers = [
      'Name',
      'Slug',
      'Status',
      'Phone',
      'Email',
      'City',
      'Orders',
      'Revenue (GHS)',
      'Joined',
    ];
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = filteredTenants.map((t) =>
      [
        t.name,
        t.slug,
        t.status,
        t.phone,
        t.email ?? '',
        t.city ?? '',
        t.orderCount,
        t.revenue.toFixed(2),
        new Date(t.created_at).toISOString().split('T')[0],
      ]
        .map(esc)
        .join(',')
    );
    // Prepend BOM so Excel reads UTF-8 correctly.
    const csv = '﻿' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `didi-tenants-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredTenants = tenants.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.slug.toLowerCase().includes(query) ||
      t.phone.includes(query) ||
      (t.email && t.email.toLowerCase().includes(query))
    );
  });

  const kpis = [
    {
      label: 'Total Restaurants',
      value: metrics.totalTenants.toString(),
      icon: Building2,
      color: 'text-brand-600',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Active',
      value: metrics.activeTenants.toString(),
      icon: Check,
      color: 'text-success-600',
      bg: 'bg-success-500/10',
    },
    {
      label: 'Suspended',
      value: metrics.suspendedTenants.toString(),
      icon: AlertTriangle,
      color: 'text-error-600',
      bg: 'bg-error-500/10',
    },
    {
      label: 'Onboarding',
      value: metrics.onboardingTenants.toString(),
      icon: Hourglass,
      color: 'text-warning-600',
      bg: 'bg-warning-500/10',
    },
    {
      label: 'Total Orders',
      value: metrics.totalOrders.toString(),
      icon: ShoppingBag,
      color: 'text-info-600',
      bg: 'bg-info-500/10',
    },
    {
      label: 'Total Revenue',
      value: formatGHS(metrics.totalRevenue),
      icon: DollarSign,
      color: 'text-success-600',
      bg: 'bg-success-500/10',
    },
    {
      label: 'Orders Today',
      value: metrics.ordersToday.toString(),
      icon: ShoppingBag,
      color: 'text-brand-600',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Revenue Today',
      value: formatGHS(metrics.revenueToday),
      icon: Clock,
      color: 'text-info-600',
      bg: 'bg-info-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50 p-6 sm:p-10 space-y-8">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-150 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-surface-900 text-brand-500 text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wider">
              SUPER-ADMIN
            </span>
            <h1 className="text-2xl font-bold text-surface-900">
              Didi Platform Admin
            </h1>
          </div>
          <p className="text-surface-500 text-sm mt-1">
            Monitor every tenant, track platform-wide orders and revenue, and
            control merchant statuses.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 border border-surface-200 bg-white text-surface-700 font-semibold rounded-xl text-xs hover:bg-surface-50 transition-colors"
        >
          Go to Merchant Dashboard
        </Link>
      </div>

      {/* KPI summaries */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl p-5 border border-surface-150 shadow-sm flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-surface-500">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold text-surface-950 mt-0.5 truncate">
                  {kpi.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenants management table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-sm font-bold text-surface-900">
            Merchant Directory
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-64 flex-shrink-0">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs shadow-sm"
              />
            </div>
            <button
              onClick={exportCsv}
              disabled={filteredTenants.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-200 bg-white text-surface-700 font-semibold text-xs hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-150 shadow-sm overflow-hidden text-xs">
          {filteredTenants.length === 0 ? (
            <div className="py-12 text-center text-surface-400 italic">
              No merchant tenants found.
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-surface-100">
              {filteredTenants.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="font-bold text-surface-900 text-sm hover:text-brand-600"
                    >
                      {t.name}
                    </Link>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${statusStyles[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-surface-500 mt-0.5">/{t.slug}</p>
                  <div className="flex items-center gap-3 text-[11px] text-surface-600 mt-2">
                    <span>{t.orderCount} orders</span>
                    <span className="font-semibold">{formatGHS(t.revenue)}</span>
                    <span className="text-surface-400 truncate">{t.phone}</span>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(t.id, t.status)}
                    disabled={actionLoading === t.id}
                    className={`mt-3 w-full py-2 rounded-xl font-bold text-[11px] transition-all active:scale-95 disabled:opacity-50 ${
                      t.status === 'active'
                        ? 'bg-error-600 text-white'
                        : 'bg-success-600 text-white'
                    }`}
                  >
                    {actionLoading === t.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                    ) : t.status === 'active' ? (
                      'Suspend'
                    ) : (
                      'Activate'
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-100 border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase select-none">
                    <th className="p-4">Merchant</th>
                    <th className="p-4">Storefront</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4 text-right">Orders</th>
                    <th className="p-4 text-right">Revenue</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {filteredTenants.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-surface-50/50 transition-colors"
                    >
                      <td className="p-4">
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="font-bold text-surface-900 text-sm hover:text-brand-600 hover:underline"
                        >
                          {t.name}
                        </Link>
                        {t.city && (
                          <p className="text-[10px] text-surface-450">
                            {t.city}
                          </p>
                        )}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-surface-500">
                        <a
                          href={`/${t.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-brand-600 hover:underline"
                        >
                          /{t.slug}
                        </a>
                      </td>
                      <td className="p-4 space-y-0.5">
                        <p className="font-semibold text-surface-800">
                          {t.phone}
                        </p>
                        {t.email && (
                          <p className="text-[10px] text-surface-450">
                            {t.email}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-surface-800">
                        {t.orderCount}
                      </td>
                      <td className="p-4 text-right font-semibold text-surface-800">
                        {formatGHS(t.revenue)}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyles[t.status]}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          disabled={actionLoading === t.id}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[10px] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 ${
                            t.status === 'active'
                              ? 'bg-error-600 text-white'
                              : 'bg-success-600 text-white'
                          }`}
                        >
                          {actionLoading === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                          ) : t.status === 'active' ? (
                            'Suspend'
                          ) : (
                            'Activate'
                          )}
                        </button>
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

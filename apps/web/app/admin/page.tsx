'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  ShieldAlert,
  Loader2,
  Users,
  Building2,
  AlertTriangle,
  Check,
  Search,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  city: string | null;
  status: 'onboarding' | 'active' | 'suspended' | 'deactivated';
  created_at: string;
}

export default function PlatformAdminPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function verifyAdminAndLoad() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Check if user is in platform_admins
      const { data: adminRecord, error: adminErr } = await supabase
        .from('platform_admins')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (adminErr || !adminRecord) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Load tenants
      const { data: tenantList } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantList) {
        setTenants(tenantList as any);
      }
      setLoading(false);
    }
    verifyAdminAndLoad();
  }, []);

  async function handleToggleStatus(tenantId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionLoading(tenantId);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status: nextStatus })
        .eq('id', tenantId);

      if (error) throw error;

      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      console.error('Failed to toggle tenant status:', err);
      alert('Failed to update tenant status.');
    } finally {
      setActionLoading(null);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs text-surface-500 mt-2">Verifying administrator credentials...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 px-4 text-center">
        <div className="w-16 h-16 bg-error-500/10 rounded-2xl flex items-center justify-center text-error-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-surface-900">Access Denied</h1>
        <p className="text-sm text-surface-500 mt-1 max-w-sm">
          You do not have permission to view the Platform Super-Admin console. Please sign in with an administrator account.
        </p>
        <a
          href="/login"
          className="mt-6 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-colors"
        >
          Go to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 p-6 sm:p-10 space-y-8">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-150 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-surface-900 text-brand-500 text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wider">
              SUPER-ADMIN
            </span>
            <h1 className="text-2xl font-bold text-surface-900">Fafa Platform Admin</h1>
          </div>
          <p className="text-surface-500 text-sm mt-1">
            Monitor and manage restaurant onboarded tenants, control statuses, and inspect metrics.
          </p>
        </div>
        <a
          href="/dashboard"
          className="px-4 py-2 border border-surface-200 bg-white text-surface-700 font-semibold rounded-xl text-xs hover:bg-surface-50 transition-colors"
        >
          Go to Merchant Dashboard
        </a>
      </div>

      {/* KPI summaries */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl">
        <div className="bg-white rounded-2xl p-5 border border-surface-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-brand-500/10 rounded-xl text-brand-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500">Total Restaurants</p>
            <p className="text-xl font-bold text-surface-950 mt-0.5">{tenants.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success-500/10 rounded-xl text-success-600">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500">Active Tenants</p>
            <p className="text-xl font-bold text-surface-950 mt-0.5">
              {tenants.filter((t) => t.status === 'active').length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-150 shadow-sm flex items-center gap-4 col-span-2 md:col-span-1">
          <div className="p-3 bg-error-500/10 rounded-xl text-error-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500">Suspended Tenants</p>
            <p className="text-xl font-bold text-surface-950 mt-0.5">
              {tenants.filter((t) => t.status === 'suspended').length}
            </p>
          </div>
        </div>
      </div>

      {/* Tenants management table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-sm font-bold text-surface-900">Merchant Directory</h2>
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
        </div>

        <div className="bg-white rounded-2xl border border-surface-150 shadow-sm overflow-hidden text-xs">
          {filteredTenants.length === 0 ? (
            <div className="py-12 text-center text-surface-400 italic">No merchant tenants onboarded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-100 border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase select-none">
                    <th className="p-4">Merchant Name</th>
                    <th className="p-4">Storefront URL</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">City</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-surface-700">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="p-4 font-bold text-surface-900 text-sm">
                        {t.name}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-surface-500">
                        /{t.slug}
                      </td>
                      <td className="p-4 space-y-0.5">
                        <p className="font-semibold text-surface-800">{t.phone}</p>
                        {t.email && <p className="text-[10px] text-surface-450">{t.email}</p>}
                      </td>
                      <td className="p-4 font-medium text-surface-600">
                        {t.city || '—'}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          t.status === 'active'
                            ? 'bg-success-500/10 text-success-700'
                            : t.status === 'suspended'
                              ? 'bg-error-500/10 text-error-700'
                              : 'bg-warning-500/10 text-warning-700'
                        }`}>
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
          )}
        </div>
      </div>
    </div>
  );
}

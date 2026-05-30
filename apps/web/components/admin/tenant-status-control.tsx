'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

type TenantStatus = 'onboarding' | 'active' | 'suspended' | 'deactivated';

const TRANSITIONS: {
  status: TenantStatus;
  label: string;
  className: string;
}[] = [
  { status: 'active', label: 'Activate', className: 'bg-success-600 text-white' },
  { status: 'suspended', label: 'Suspend', className: 'bg-error-600 text-white' },
  {
    status: 'deactivated',
    label: 'Deactivate',
    className: 'bg-surface-700 text-white',
  },
];

export default function TenantStatusControl({
  tenantId,
  status,
}: {
  tenantId: string;
  status: TenantStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<TenantStatus | null>(null);
  const [error, setError] = useState('');

  async function handleImpersonate() {
    setError('');
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        throw new Error('Failed to set impersonation state');
      }

      // Set cookie client-side
      document.cookie = `didi_impersonate_tenant_id=${tenantId}; path=/; max-age=31536000; SameSite=Lax`;
      
      // Redirect
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Impersonation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function setStatus(next: TenantStatus) {
    setLoading(next);
    setError('');
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Update failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleImpersonate}
          className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-brand-500 text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer"
        >
          Impersonate (View as Tenant)
        </button>
        {TRANSITIONS.filter((t) => t.status !== status).map((t) => (
          <button
            key={t.status}
            onClick={() => setStatus(t.status)}
            disabled={loading !== null}
            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 ${t.className}`}
          >
            {loading === t.status ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-error-600 mt-2">{error}</p>}
    </div>
  );
}

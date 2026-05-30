'use client';

import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

export default function ImpersonationBanner({ tenantName }: { tenantName: string }) {
  const router = useRouter();

  function handleStopImpersonation() {
    // Clear the impersonation cookie
    document.cookie = 'didi_impersonate_tenant_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="bg-amber-600 text-white px-4 py-3 text-xs sm:text-sm font-bold flex items-center justify-between gap-4 shadow-md sticky top-0 z-50 animate-slide-in">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-100" />
        <span>
          Viewing dashboard as <strong className="underline">{tenantName}</strong> (Platform Admin Mode)
        </span>
      </div>
      <button
        onClick={handleStopImpersonation}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all text-xs font-bold active:scale-95 cursor-pointer shrink-0"
      >
        Stop Impersonation
      </button>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Users,
  CreditCard,
  BarChart3,
  QrCode,
  Settings,
  LogOut,
  MoreHorizontal,
  ExternalLink,
  X,
  ChevronRight,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

/* Primary tabs live in the bottom bar; everything else lives in the “More” sheet. */
const primaryTabs = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed },
  { label: 'Customers', href: '/customers', icon: Users },
];

const moreItems = [
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Share & QR', href: '/share', icon: QrCode },
  { label: 'Settings', href: '/settings/profile', icon: Settings },
];

const moreHrefs = moreItems.map((i) => i.href);

export function MobileNav({
  tenantName,
  logoUrl,
  primaryColor,
  tenantSlug,
}: {
  tenantName?: string;
  logoUrl?: string;
  primaryColor?: string;
  tenantSlug?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const accent = primaryColor || '#FF6B35';

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  const moreActive = moreHrefs.some((h) => pathname.startsWith(h));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* ── Slim top app bar ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 glass border-b border-hairline pt-safe">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt={tenantName || 'Logo'} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: accent }}
              >
                {tenantName ? tenantName.charAt(0) : 'D'}
              </div>
            )}
            <h1 className="text-sm font-bold text-surface-900 truncate">{tenantName || 'Didi'}</h1>
          </div>
          {tenantSlug && (
            <a
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-surface-100 active:bg-surface-200 text-surface-700 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View store
            </a>
          )}
        </div>
      </header>

      {/* ── Bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-hairline pb-safe">
        <div className="grid grid-cols-5 h-16">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
                style={{ color: active ? accent : undefined }}
              >
                <Icon className={`w-[22px] h-[22px] ${active ? '' : 'text-surface-400'}`} />
                <span className={`text-[10px] font-bold ${active ? '' : 'text-surface-400'}`}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 transition-colors active:scale-95"
            style={{ color: moreActive ? accent : undefined }}
          >
            <MoreHorizontal className={`w-[22px] h-[22px] ${moreActive ? '' : 'text-surface-400'}`} />
            <span className={`text-[10px] font-bold ${moreActive ? '' : 'text-surface-400'}`}>More</span>
          </button>
        </div>
      </nav>

      {/* ── “More” sheet ── */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl animate-slide-up pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-surface-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
              <h2 className="text-lg font-bold text-surface-900">More</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100 active:scale-95 transition-all"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            <div className="p-3">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-semibold text-surface-700 active:bg-surface-100 transition-colors"
                    style={active ? { backgroundColor: `${accent}15`, color: accent } : undefined}
                  >
                    <Icon className="w-5 h-5" style={active ? { color: accent } : { color: 'var(--color-surface-400)' }} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-surface-300" />
                  </Link>
                );
              })}
              <div className="h-px bg-surface-100 my-2" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-semibold text-surface-600 active:bg-error-500/10 hover:text-error-600 transition-colors w-full"
              >
                <LogOut className="w-5 h-5 text-surface-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

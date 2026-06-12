'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronRight,
} from 'lucide-react';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ShoppingBag,
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    label: 'Share & QR',
    href: '/share',
    icon: QrCode,
  },
];

const settingsItems = [
  {
    label: 'Settings',
    href: '/settings/profile',
    icon: Settings,
  },
];

export function Sidebar({
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

  useEffect(() => {
    if (tenantSlug) {
      const branding = {
        name: tenantName || '',
        logoUrl: logoUrl || '',
        primaryColor: primaryColor || '#FF6B35',
        slug: tenantSlug,
      };
      localStorage.setItem('fafa_last_tenant', JSON.stringify(branding));
      document.cookie = `fafa_last_tenant_slug=${tenantSlug}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [tenantName, logoUrl, primaryColor, tenantSlug]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-hairline">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenantName || 'Logo'}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor || '#FF6B35' }}
              >
                {tenantName ? tenantName.charAt(0) : 'F'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-surface-900 truncate max-w-[140px]">
                {tenantName || 'Didi'}
              </h1>
              <p className="text-[10px] text-surface-400 font-semibold tracking-wider uppercase mt-0.5">
                Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? primaryColor
                    ? ''
                    : 'bg-brand-500/10 text-brand-600'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              }`}
              style={
                active && primaryColor
                  ? {
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  active
                    ? primaryColor
                      ? ''
                      : 'text-brand-500'
                    : 'text-surface-400 group-hover:text-surface-600'
                }`}
                style={active && primaryColor ? { color: primaryColor } : undefined}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight
                  className={`w-4 h-4 ${primaryColor ? '' : 'text-brand-400'}`}
                  style={active && primaryColor ? { color: primaryColor } : undefined}
                />
              )}
            </Link>
          );
        })}

        <div className="h-px bg-surface-100 my-3" />

        {settingsItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? primaryColor
                    ? ''
                    : 'bg-brand-500/10 text-brand-600'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              }`}
              style={
                active && primaryColor
                  ? {
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  active
                    ? primaryColor
                      ? ''
                      : 'text-brand-500'
                    : 'text-surface-400 group-hover:text-surface-600'
                }`}
                style={active && primaryColor ? { color: primaryColor } : undefined}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}

      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-hairline">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-500 hover:bg-error-500/10 hover:text-error-600 transition-all w-full group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-error-500 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    /* Desktop sidebar only — mobile navigation is handled by <MobileNav />.
       Floating panel: inset from the canvas with a soft outer shadow. */
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 p-3 pr-0">
      <div className="flex flex-col h-full w-full rounded-3xl bg-white border border-hairline shadow-float overflow-hidden">
        {sidebarContent}
      </div>
    </aside>
  );
}

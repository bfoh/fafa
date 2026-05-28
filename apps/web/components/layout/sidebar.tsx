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
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <div className="p-5 border-b border-surface-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenantName || 'Logo'}
                className="w-9 h-9 rounded-xl object-cover"
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
                {tenantName || 'Fafa'}
              </h1>
              <p className="text-[10px] text-surface-400 font-semibold tracking-wider uppercase mt-0.5">
                Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <X className="w-5 h-5 text-surface-500" />
          </button>
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
              onClick={() => setMobileOpen(false)}
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
              onClick={() => setMobileOpen(false)}
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
      <div className="p-3 border-t border-surface-100">
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
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl bg-white shadow-md border border-surface-200 hover:bg-surface-50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-surface-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-surface-100">
        {sidebarContent}
      </aside>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Palette,
  Truck,
  Bell,
  Sparkles,
  CreditCard,
} from 'lucide-react';

const tabs = [
  {
    label: 'Profile',
    href: '/settings/profile',
    icon: User,
  },
  {
    label: 'Branding',
    href: '/settings/branding',
    icon: Palette,
  },
  {
    label: 'Delivery & Setup',
    href: '/settings/delivery',
    icon: Truck,
  },
  {
    label: 'Payouts & Payments',
    href: '/settings/payments',
    icon: CreditCard,
  },
  {
    label: 'Notifications History',
    href: '/settings/notifications',
    icon: Bell,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-500" />
          Restaurant Configuration
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Customize your restaurant details, branding visual system, delivery options, and notification settings.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-surface-100 p-4 shadow-sm space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-brand-500/10 text-brand-600'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? 'text-brand-500' : 'text-surface-400'
                  }`}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Dynamic Panel */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-surface-100 p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

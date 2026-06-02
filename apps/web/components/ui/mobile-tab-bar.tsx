'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
}

/**
 * Fixed bottom navigation for customer-facing surfaces. Hidden on md:+
 * (desktop keeps top navigation). Caller supplies the context-specific tabs.
 * Add `pb-[calc(env(safe-area-inset-bottom)+4.5rem)]` to scroll content so it
 * clears this bar.
 */
export function MobileTabBar({
  tabs,
  accent = '#FF6B35',
}: {
  tabs: TabItem[];
  accent?: string;
}) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/70 backdrop-blur-2xl border-t border-white/10 pb-safe">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const color = tab.active ? accent : 'rgba(255,255,255,0.55)';
          const inner = (
            <span className="relative flex flex-col items-center justify-center gap-1 h-full transition-transform active:scale-90">
              <span className="relative">
                <Icon className="w-[22px] h-[22px]" style={{ color }} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-brand-500 text-white text-[10px] font-bold leading-none">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold" style={{ color }}>
                {tab.label}
              </span>
            </span>
          );
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className="block h-full">
              {inner}
            </Link>
          ) : (
            <button
              key={tab.label}
              type="button"
              onClick={tab.onClick}
              className="block h-full"
            >
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

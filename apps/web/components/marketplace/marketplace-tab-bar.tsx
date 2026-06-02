'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, ReceiptText, User } from 'lucide-react';
import { MobileTabBar } from '@/components/ui/mobile-tab-bar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import {
  loadRecentOrders,
  loadCustomer,
  type RecentOrder,
  type SavedCustomer,
} from '@/lib/utils/customer-prefs';

export function MarketplaceTabBar() {
  const pathname = usePathname();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [customer, setCustomer] = useState<SavedCustomer | null>(null);

  return (
    <>
      <MobileTabBar
        tabs={[
          { label: 'Home', icon: Home, href: '/', active: pathname === '/' },
          {
            label: 'Search',
            icon: Search,
            onClick: () =>
              document
                .getElementById('hero-search')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          },
          {
            label: 'Orders',
            icon: ReceiptText,
            onClick: () => {
              setOrders(loadRecentOrders());
              setOrdersOpen(true);
            },
          },
          {
            label: 'Account',
            icon: User,
            onClick: () => {
              setCustomer(loadCustomer());
              setAccountOpen(true);
            },
          },
        ]}
      />

      <BottomSheet
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        title="Your recent orders"
      >
        <div className="p-4 space-y-2">
          {orders.length === 0 && (
            <p className="text-sm text-surface-500 py-8 text-center">
              No recent orders yet.
            </p>
          )}
          {orders.map((o) => (
            <Link
              key={o.orderId}
              href={`/${o.slug}/order/${o.orderId}`}
              onClick={() => setOrdersOpen(false)}
              className="flex items-center justify-between rounded-xl border border-surface-100 px-4 py-3 active:bg-surface-50"
            >
              <span className="font-semibold text-sm">{o.orderNumber}</span>
              <span className="text-xs text-surface-400">
                {new Date(o.savedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Your details"
      >
        <div className="p-4 space-y-3 text-sm">
          {customer ? (
            <>
              <p>
                <span className="text-surface-400">Name:</span>{' '}
                <b>{customer.name}</b>
              </p>
              <p>
                <span className="text-surface-400">Phone:</span>{' '}
                <b>{customer.phone}</b>
              </p>
              {customer.address && (
                <p>
                  <span className="text-surface-400">Address:</span>{' '}
                  {customer.address}
                </p>
              )}
            </>
          ) : (
            <p className="text-surface-500 py-6 text-center">
              No saved details yet. They&apos;ll appear after your first order.
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

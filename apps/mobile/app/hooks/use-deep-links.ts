'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Translates external deep links (App Links / Universal Links) into internal
 * routes. The native layer hands us the tapped https URL; we map:
 *
 *   ghdidi.com/<slug>                       → /store/?slug=<slug>
 *   ghdidi.com/<slug>/order/<orderId>       → /order/?id=<orderId>&slug=<slug>
 *
 * Requires assetlinks.json (Android) + apple-app-site-association (iOS) served
 * from ghdidi.com/.well-known (added under apps/web/public). No-op off-device.
 */
export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    (async () => {
      const h = await CapApp.addListener('appUrlOpen', ({ url }) => {
        try {
          const { pathname } = new URL(url);
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length === 0) return;

          const orderIdx = parts.indexOf('order');
          if (orderIdx >= 0 && parts[orderIdx + 1]) {
            const slug = parts[0];
            const orderId = parts[orderIdx + 1];
            router.push(`/order/?id=${orderId}&slug=${slug}`);
          } else {
            router.push(`/store/?slug=${parts[0]}`);
          }
        } catch {
          // ignore malformed urls
        }
      });
      if (cancelled) void h.remove();
      else handle = h;
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [router]);
}

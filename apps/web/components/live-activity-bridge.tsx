'use client';

import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Starts an iOS Live Activity for an active order and registers its APNs
 * update token with the backend. The 'LiveActivity' plugin ships in the iOS
 * shell binary; on web/Android/old-iOS it is absent or unavailable and this
 * is a silent no-op. Backend pushes drive every later update.
 */

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: {
    orderId: string;
    orderNumber: string;
    tenantName: string;
    slug: string;
    deliveryType: string;
    statusText: string;
  }): Promise<{ token?: string }>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

const TERMINAL = ['delivered', 'cancelled'];

export function LiveActivityBridge({
  orderId,
  orderNumber,
  tenantName,
  slug,
  deliveryType,
  status,
}: {
  orderId: string;
  orderNumber: string;
  tenantName: string;
  slug: string;
  deliveryType: string;
  status: string;
}) {
  useEffect(() => {
    // Failures surface server-side ([live-activity] in Vercel logs): release
    // WebViews aren't inspectable, so this is the only window into the device.
    const report = (debug: string) =>
      fetch('/api/live-activity/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, debug }),
      }).catch(() => {});

    // Debug: report every mount so the environment itself is visible.
    void report(
      `mount native=${Capacitor.isNativePlatform()} platform=${Capacitor.getPlatform()} ` +
        `winCap=${!!(window as unknown as { Capacitor?: unknown }).Capacitor} status=${status} ` +
        `ua=${navigator.userAgent.slice(0, 80)}`
    );

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
    if (TERMINAL.includes(status)) return;

    (async () => {
      try {
        const { available } = await LiveActivity.isAvailable();
        if (!available) {
          void report('isAvailable=false');
          return;
        }
        const { token } = await LiveActivity.start({
          orderId,
          orderNumber,
          tenantName,
          slug,
          deliveryType,
          statusText: 'Order confirmed',
        });
        if (token) {
          await fetch('/api/live-activity/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, token }),
          });
        } else {
          void report('start resolved without token');
        }
      } catch (err) {
        void report(`start failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, [orderId, orderNumber, tenantName, slug, deliveryType, status]);

  return null;
}

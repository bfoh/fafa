'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: Array<{ remove: () => Promise<void> }> = [];
    let cancelled = false;

    (async () => {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted' || cancelled) return;

      handles.push(
        await PushNotifications.addListener('registrationError', (err) => {
          console.error('[push] registration error:', JSON.stringify(err));
        })
      );

      await PushNotifications.register();

      handles.push(
        await PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch(`${API}/api/devices/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
                customerPhone: null,
              }),
            });
          } catch {
            // best-effort; retried on next launch
          }
        })
      );

      handles.push(
        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const data = action.notification.data as
              | { orderId?: string; slug?: string }
              | undefined;
            if (data?.orderId) {
              const slug = data.slug ? `&slug=${data.slug}` : '';
              window.location.assign(`/order/?id=${data.orderId}${slug}`);
            }
          }
        )
      );
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

async function registerToken(token: string, customerPhone: string | null) {
  await fetch(`${API}/api/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: Capacitor.getPlatform(), customerPhone }),
  });
}

export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: Array<{ remove: () => Promise<void> }> = [];
    let cancelled = false;

    (async () => {
      let perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted' || cancelled) return;

      const { token } = await FirebaseMessaging.getToken();
      if (!token || cancelled) return;

      try { await registerToken(token, null); } catch { }

      handles.push(
        await FirebaseMessaging.addListener('tokenReceived', async ({ token: t }) => {
          try { await registerToken(t, null); } catch { }
        })
      );

      handles.push(
        await FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
          const data = action.notification.data as { orderId?: string; slug?: string } | undefined;
          if (data?.orderId) {
            const slug = data.slug ? `&slug=${data.slug}` : '';
            window.location.assign(`/order/?id=${data.orderId}${slug}`);
          }
        })
      );
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, []);

  return null;
}

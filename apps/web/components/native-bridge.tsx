'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { App as CapApp } from '@capacitor/app';
import { pushTargetUrl, trackerPathFromUrl } from '@/lib/push/notification-url';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

async function registerToken(token: string, customerPhone: string | null) {
  await fetch(`${API}/api/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: Capacitor.getPlatform(), customerPhone }),
  });
}

export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: Array<{ remove: () => Promise<void> }> = [];
    let cancelled = false;

    (async () => {
      // Attach the tap handler before any permission/token round trips: a tap
      // that cold-started the app is queued by the native layer and delivered
      // the moment this listener registers, so every await before this line is
      // time the customer spends staring at the landing page. Client-side
      // router navigation (vs location.assign) avoids a second full page load.
      handles.push(
        await FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
          const data = action.notification.data as
            | { path?: string; orderId?: string; slug?: string }
            | undefined;
          const url = pushTargetUrl(data);
          if (url) router.push(url);
        })
      );

      // Widget taps arrive as universal links (Live Activity widgetURL).
      handles.push(
        await CapApp.addListener('appUrlOpen', ({ url }) => {
          const path = trackerPathFromUrl(url);
          if (path) router.push(path);
        })
      );

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
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, [router]);

  return null;
}

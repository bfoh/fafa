'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

/**
 * Re-registers the device push token from inside the dashboard. NativeBridge
 * already registers at app launch, but an owner who logs in afterwards would
 * stay unlinked until the next cold start — this re-post runs with the fresh
 * session cookie, letting the server attach tenant_id to the token.
 */
export function OwnerPushBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        let perm = await FirebaseMessaging.checkPermissions();
        if (perm.receive !== 'granted') {
          perm = await FirebaseMessaging.requestPermissions();
          if (perm.receive !== 'granted') return;
        }
        const { token } = await FirebaseMessaging.getToken();
        if (!token) return;
        await fetch('/api/devices/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, platform: Capacitor.getPlatform(), customerPhone: null }),
        });
      } catch {
        // Best-effort — launch-time registration remains the baseline.
      }
    })();
  }, []);

  return null;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
} from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://www.ghdidi.com';
const FLUSH_EVERY_MS = 15_000;
const FLUSH_AT_POINTS = 5;

interface Point {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  bearing: number | null;
  speed: number | null;
  recordedAt: number;
}

/**
 * Rider background geolocation. Battery-tuned (distanceFilter 25m → only emits
 * on real movement), batches fixes and flushes to /api/rider/location. On
 * Android a foreground-service notification keeps tracking alive in the
 * background. Requeues on upload failure so a dropped signal never loses a trail.
 *
 * Production hardening: swap the community plugin for Transistorsoft
 * (@transistorsoft/capacitor-background-geolocation) for best iOS background +
 * Doze handling. The start/stop/batch shape here is the same.
 */
export function useRiderTracking(getToken: () => Promise<string | null>) {
  const watcherId = useRef<string | null>(null);
  const orderId = useRef<string | null>(null);
  const buffer = useRef<Point[]>([]);
  const [tracking, setTracking] = useState(false);

  const flush = useCallback(async () => {
    if (!orderId.current || buffer.current.length === 0) return;
    const batch = buffer.current.splice(0);
    const token = await getToken();
    if (!token) {
      buffer.current.unshift(...batch); // keep for next flush
      return;
    }
    try {
      const res = await fetch(`${API}/api/rider/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: orderId.current, points: batch }),
      });
      if (!res.ok) throw new Error(`ingest ${res.status}`);
    } catch {
      buffer.current.unshift(...batch); // requeue on failure
    }
  }, [getToken]);

  const start = useCallback(
    async (assignedOrderId: string) => {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('Live tracking requires the installed Didi app.');
      }
      if (watcherId.current) return;
      orderId.current = assignedOrderId;

      watcherId.current = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Didi is sharing your delivery location.',
          backgroundTitle: 'Delivering an order',
          requestPermissions: true,
          stale: false,
          distanceFilter: 25,
        },
        (location, error) => {
          if (error || !location) return;
          buffer.current.push({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy ?? null,
            bearing: location.bearing,
            speed: location.speed,
            recordedAt: location.time ?? Date.now(),
          });
          if (buffer.current.length >= FLUSH_AT_POINTS) void flush();
        }
      );
      setTracking(true);
    },
    [flush]
  );

  const stop = useCallback(async () => {
    if (watcherId.current) {
      await BackgroundGeolocation.removeWatcher({ id: watcherId.current });
      watcherId.current = null;
    }
    await flush();
    orderId.current = null;
    setTracking(false);
  }, [flush]);

  // Periodic flush while tracking.
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => void flush(), FLUSH_EVERY_MS);
    return () => clearInterval(t);
  }, [tracking, flush]);

  return { start, stop, tracking };
}

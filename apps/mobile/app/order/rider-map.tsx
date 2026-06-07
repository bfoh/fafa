'use client';

import { useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';
const POLL_MS = 8_000;

interface RiderLocation {
  latitude: number;
  longitude: number;
}

/**
 * Live rider map for the customer. Polls /api/orders/[id]/location (service-role
 * keyed by the unguessable order_id) every few seconds — rider_locations is NOT
 * exposed to the anon key (see migration 025). Leaflet is imported dynamically
 * (it touches `window`) so the static-export prerender stays clean. Accra is the
 * default center until a fix arrives.
 */
export function RiderMap({ orderId }: { orderId: string }) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let map: import('leaflet').Map | undefined;
    let marker: import('leaflet').Marker | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !elRef.current) return;

      const m = L.map(elRef.current).setView([5.6037, -0.187], 13); // Accra
      map = m;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m);

      const place = (row: RiderLocation) => {
        const ll: [number, number] = [row.latitude, row.longitude];
        if (!marker) marker = L.marker(ll).addTo(m);
        else marker.setLatLng(ll);
        m.setView(ll, m.getZoom());
      };

      const poll = async () => {
        try {
          const res = await fetch(`${API}/api/orders/${orderId}/location`);
          if (!res.ok) return;
          const { location } = (await res.json()) as {
            location: RiderLocation | null;
          };
          if (mounted && location) place(location);
        } catch {
          // offline tick — keep last position
        }
      };

      await poll();
      timer = setInterval(poll, POLL_MS);
    })();

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (map) map.remove();
    };
  }, [orderId]);

  return (
    <div
      ref={elRef}
      className="h-64 w-full rounded-2xl overflow-hidden border border-hairline"
    />
  );
}

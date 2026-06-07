'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '../providers';

interface LatLngRow {
  latitude: number;
  longitude: number;
}

/**
 * Live rider map for the customer. Loads the latest breadcrumb for the order,
 * then subscribes to rider_locations INSERTs via Supabase Realtime and moves the
 * marker. Leaflet is imported dynamically (it touches `window`) so the static
 * export prerender stays clean. Accra is the default center until a fix arrives.
 */
export function RiderMap({ orderId }: { orderId: string }) {
  const supabase = useSupabase();
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    let map: import('leaflet').Map | undefined;
    let marker: import('leaflet').Marker | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !elRef.current) return;

      const m = L.map(elRef.current).setView([5.6037, -0.187], 13); // Accra
      map = m;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m);

      const place = (row: LatLngRow) => {
        const ll: [number, number] = [row.latitude, row.longitude];
        if (!marker) marker = L.marker(ll).addTo(m);
        else marker.setLatLng(ll);
        m.setView(ll, m.getZoom());
      };

      // Latest known position.
      const { data } = await supabase
        .from('rider_locations')
        .select('latitude, longitude')
        .eq('order_id', orderId)
        .order('recorded_at', { ascending: false })
        .limit(1);
      if (mounted && data?.[0]) place(data[0] as LatLngRow);

      // Live updates.
      channel = supabase
        .channel(`rider_${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rider_locations',
            filter: `order_id=eq.${orderId}`,
          },
          (payload: { new: LatLngRow }) => place(payload.new)
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (map) map.remove();
    };
  }, [orderId, supabase]);

  return <div ref={elRef} className="h-64 w-full rounded-2xl overflow-hidden border border-hairline" />;
}

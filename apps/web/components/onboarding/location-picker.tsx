'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../../lib/marketplace/geo';

export default function LocationPicker({
  center,
  value,
  onChange,
}: {
  center?: [number, number];
  value?: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const start: [number, number] = value
        ? [value.lat, value.lng]
        : center || DEFAULT_CENTER;

      const map = L.map(elRef.current).setView(start, 13);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChange(p.lat, p.lng);
      });
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when the chosen city changes (map already mounted).
  useEffect(() => {
    if (mapRef.current && center && !value) {
      mapRef.current.setView(center, 13);
      if (markerRef.current) markerRef.current.setLatLng(center);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return (
    <div
      ref={elRef}
      className="w-full h-56 rounded-xl border border-surface-200 overflow-hidden z-0"
    />
  );
}

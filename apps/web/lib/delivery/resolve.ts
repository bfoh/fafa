import { findNeighborhood } from './ghana-areas';
import { computeDeliveryFee, haversineKm } from './pricing';

export interface ManualZone {
  name: string;
  fee: number;
}

export interface RestaurantDelivery {
  lat: number | null;
  lng: number | null;
  baseFee: number;
  freeRadiusKm: number | null;
  perKmRate: number | null;
  maxDistanceKm: number | null;
}

export interface ResolveInput {
  restaurant: RestaurantDelivery;
  city: string;
  areaName: string;
  manualZones: ManualZone[]; // active zones only
}

export interface ResolveResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number | null;
  source: 'override' | 'distance' | 'base';
}

export function resolveDeliveryFee(input: ResolveInput): ResolveResult {
  const { restaurant, city, areaName, manualZones } = input;

  // 1. Manual zone override (exact area name, case-insensitive).
  const q = areaName.trim().toLowerCase();
  const override = manualZones.find((z) => z.name.trim().toLowerCase() === q);
  if (override) {
    return { fee: override.fee, deliverable: true, distanceKm: null, source: 'override' };
  }

  // 2. Distance pricing when we have both ends.
  const area = findNeighborhood(city, areaName);
  if (restaurant.lat != null && restaurant.lng != null && area) {
    const distanceKm = haversineKm(
      { lat: restaurant.lat, lng: restaurant.lng },
      { lat: area.lat, lng: area.lng }
    );
    const r = computeDeliveryFee({
      baseFee: restaurant.baseFee,
      distanceKm,
      freeRadiusKm: restaurant.freeRadiusKm ?? undefined,
      perKmRate: restaurant.perKmRate ?? undefined,
      maxDistanceKm: restaurant.maxDistanceKm,
    });
    return { fee: r.fee, deliverable: r.deliverable, distanceKm: r.distanceKm, source: 'distance' };
  }

  // 3. Fallback: base fee.
  return { fee: restaurant.baseFee, deliverable: true, distanceKm: null, source: 'base' };
}

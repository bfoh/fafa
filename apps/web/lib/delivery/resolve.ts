import { findNeighborhood } from './ghana-areas';
import { computeDeliveryFee, haversineKm, type LatLng, type FeeBreakdown } from './pricing';

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
  customer?: LatLng | null; // optional exact pin
}

export interface ResolveResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number | null;
  source: 'override' | 'distance' | 'base';
  distanceSource: 'pin' | 'centroid' | null;
  breakdown: FeeBreakdown | null;
}

export function resolveDeliveryFee(input: ResolveInput): ResolveResult {
  const { restaurant, city, areaName, manualZones, customer } = input;

  // 1. Manual zone override (exact area name, case-insensitive).
  const q = areaName.trim().toLowerCase();
  const override = manualZones.find((z) => z.name.trim().toLowerCase() === q);
  if (override) {
    return {
      fee: override.fee,
      deliverable: true,
      distanceKm: null,
      source: 'override',
      distanceSource: null,
      breakdown: null,
    };
  }

  // 2. Distance pricing. Destination = pin if given, else the area centroid.
  const hasCoords = restaurant.lat != null && restaurant.lng != null;
  const area = findNeighborhood(city, areaName);
  const dest: LatLng | null = customer ?? (area ? { lat: area.lat, lng: area.lng } : null);
  const distanceSource: 'pin' | 'centroid' | null = customer
    ? 'pin'
    : area
    ? 'centroid'
    : null;

  if (hasCoords && dest) {
    const distanceKm = haversineKm(
      { lat: restaurant.lat as number, lng: restaurant.lng as number },
      dest
    );
    const r = computeDeliveryFee({
      baseFee: restaurant.baseFee,
      distanceKm,
      freeRadiusKm: restaurant.freeRadiusKm ?? undefined,
      perKmRate: restaurant.perKmRate ?? undefined,
      maxDistanceKm: restaurant.maxDistanceKm,
    });
    return {
      fee: r.fee,
      deliverable: r.deliverable,
      distanceKm: r.distanceKm,
      source: 'distance',
      distanceSource,
      breakdown: r.breakdown,
    };
  }

  // 3. Fallback: base fee.
  return {
    fee: restaurant.baseFee,
    deliverable: true,
    distanceKm: null,
    source: 'base',
    distanceSource: null,
    breakdown: null,
  };
}

// Pure delivery-pricing math. No I/O. Imported by the checkout client (preview)
// and the orders API (authoritative). Distance is straight-line (haversine).

export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_FREE_RADIUS_KM = 3;
export const DEFAULT_PER_KM_RATE = 2.5; // GH₵ per km beyond the free radius
export const FEE_ROUNDING = 0.5; // round fee to nearest ₵0.50

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface FeeInput {
  baseFee: number;
  distanceKm: number;
  freeRadiusKm?: number;
  perKmRate?: number;
  maxDistanceKm?: number | null;
}

export interface FeeResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number;
  withinRadius: boolean;
}

export function computeDeliveryFee(input: FeeInput): FeeResult {
  const radius = input.freeRadiusKm ?? DEFAULT_FREE_RADIUS_KM;
  const perKm = input.perKmRate ?? DEFAULT_PER_KM_RATE;
  const distanceKm = input.distanceKm;
  const withinRadius = distanceKm <= radius;

  const deliverable =
    input.maxDistanceKm == null || distanceKm <= input.maxDistanceKm;

  let fee: number;
  if (withinRadius) {
    fee = input.baseFee;
  } else {
    const extraKm = Math.ceil(distanceKm - radius);
    fee = input.baseFee + extraKm * perKm;
  }

  fee = Math.max(roundTo(fee, FEE_ROUNDING), input.baseFee);

  return { fee, deliverable, distanceKm, withinRadius };
}

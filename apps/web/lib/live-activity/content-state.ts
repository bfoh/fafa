/**
 * Pure content-state logic for lock-screen order tracking (iOS Live Activity /
 * Android ongoing notification). No I/O here — everything is unit-testable.
 * Spec: docs/superpowers/specs/2026-06-11-live-activity-design.md
 */

export type ActivityPhase =
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface ActivityContentState {
  phase: ActivityPhase;
  progress: number; // 0..1 within the on_the_way leg; 1 once delivered
  etaMinutes: number | null;
  statusText: string;
  distanceMeters: number | null;
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function phaseForStatus(status: string): ActivityPhase | null {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'confirmed';
    case 'preparing':
      return 'preparing';
    case 'ready':
      return 'ready';
    case 'out_for_delivery':
      return 'on_the_way';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

/** Progress within the delivery leg: monotonic (never backslides on GPS jitter). */
export function deliveryProgress(
  initialM: number,
  remainingM: number,
  lastProgress: number | null
): number {
  const raw = initialM > 0 ? 1 - remainingM / initialM : 0;
  const clamped = Math.min(1, Math.max(0, raw));
  return lastProgress != null ? Math.max(lastProgress, clamped) : clamped;
}

const MIN_SPEED_MPS = 1.5; // ≈5 km/h — below this, rider is effectively stopped
const MAX_SPEED_MPS = 15; // ≈54 km/h — city ceiling; GPS speed spikes clipped
const FALLBACK_SPEED_MPS = 5.5; // ≈20 km/h city average

export function deliveryEtaMinutes(remainingM: number, speedMps: number | null): number {
  const speed = Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, speedMps ?? FALLBACK_SPEED_MPS));
  return Math.max(1, Math.round(remainingM / speed / 60));
}

export function prepEtaMinutes(
  estimatedReadyAt: string | null,
  zoneMinutes: number | null,
  now: Date
): number | null {
  if (!estimatedReadyAt) return null;
  const prepMs = new Date(estimatedReadyAt).getTime() - now.getTime();
  const prepMin = Math.max(0, prepMs / 60000);
  return Math.max(1, Math.round(prepMin + (zoneMinutes ?? 0)));
}

const ARRIVING_THRESHOLD_M = 300;

export function statusTextFor(phase: ActivityPhase, distanceMeters: number | null): string {
  switch (phase) {
    case 'confirmed':
      return 'Order confirmed';
    case 'preparing':
      return 'Preparing your order';
    case 'ready':
      return 'Your order is ready!';
    case 'on_the_way':
      if (distanceMeters == null) return 'Rider is on the way';
      if (distanceMeters <= ARRIVING_THRESHOLD_M) return 'Rider is arriving 🛵';
      return `Rider is on the way — ${(distanceMeters / 1000).toFixed(1)} km`;
    case 'delivered':
      return 'Delivered. Enjoy your meal! 🎉';
    case 'cancelled':
      return 'Your order was cancelled';
  }
}

const MIN_PUSH_INTERVAL_MS = 20000;
const MIN_VISIBLE_PROGRESS_DELTA = 0.02;

/** Throttle for rider-movement updates. Status-change pushes bypass this. */
export function shouldPushRiderUpdate(
  prev: { lastPushedAt: string | null; lastProgress: number | null; lastEtaMinutes: number | null },
  next: { progress: number; etaMinutes: number | null },
  now: Date
): boolean {
  if (prev.lastPushedAt == null) return true;
  if (now.getTime() - new Date(prev.lastPushedAt).getTime() < MIN_PUSH_INTERVAL_MS) return false;
  const progressMoved =
    prev.lastProgress == null ||
    Math.abs(next.progress - prev.lastProgress) >= MIN_VISIBLE_PROGRESS_DELTA;
  const etaChanged = next.etaMinutes !== prev.lastEtaMinutes;
  return progressMoved || etaChanged;
}

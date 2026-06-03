import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  computeDeliveryFee,
  DEFAULT_FREE_RADIUS_KM,
  DEFAULT_PER_KM_RATE,
} from './pricing';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm({ lat: 5.6, lng: -0.18 }, { lat: 5.6, lng: -0.18 })).toBeCloseTo(0, 5);
  });

  it('matches a known distance (Accra centroid → East Legon ~4km)', () => {
    const d = haversineKm({ lat: 5.6037, lng: -0.187 }, { lat: 5.636, lng: -0.166 });
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(5);
  });
});

describe('computeDeliveryFee', () => {
  it('charges only base within the free radius', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 2 });
    expect(r.fee).toBe(10);
    expect(r.withinRadius).toBe(true);
    expect(r.deliverable).toBe(true);
  });

  it('adds per-km beyond the radius (ceil of extra km)', () => {
    // 3km free, 6.2km → ceil(3.2)=4 extra km * 2.5 = 10 → 10 + 10 = 20
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 6.2 });
    expect(r.withinRadius).toBe(false);
    expect(r.fee).toBe(20);
  });

  it('rounds to nearest 0.5', () => {
    // 3km free, 4.1km → ceil(1.1)=2 * 1.7 = 3.4 → base 7 + 3.4 = 10.4 → 10.5
    const r = computeDeliveryFee({ baseFee: 7, distanceKm: 4.1, perKmRate: 1.7 });
    expect(r.fee).toBe(10.5);
  });

  it('never goes below base', () => {
    const r = computeDeliveryFee({ baseFee: 15, distanceKm: 0.2 });
    expect(r.fee).toBe(15);
  });

  it('flags not deliverable past maxDistanceKm', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 25, maxDistanceKm: 15 });
    expect(r.deliverable).toBe(false);
  });

  it('uses defaults when radius/perKm omitted', () => {
    expect(DEFAULT_FREE_RADIUS_KM).toBe(3);
    expect(DEFAULT_PER_KM_RATE).toBe(2.5);
  });
});

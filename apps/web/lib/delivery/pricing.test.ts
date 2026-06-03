import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  computeDeliveryFee,
  estimateMinutes,
  DEFAULT_FREE_RADIUS_KM,
  DEFAULT_PER_KM_RATE,
  AVG_SPEED_KM_PER_MIN,
  DEFAULT_PREP_MINUTES,
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

describe('computeDeliveryFee breakdown', () => {
  it('is all base with zero extras within the radius', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 2 });
    expect(r.breakdown).toEqual({ base: 10, extraKm: 0, perKm: DEFAULT_PER_KM_RATE, extraCharge: 0 });
  });

  it('reports extra km and charge beyond the radius', () => {
    // 3km free, 6.2km → ceil(3.2)=4 extra km * 2.5 = 10
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 6.2 });
    expect(r.breakdown.base).toBe(10);
    expect(r.breakdown.extraKm).toBe(4);
    expect(r.breakdown.perKm).toBe(2.5);
    expect(r.breakdown.extraCharge).toBe(10);
  });
});

describe('estimateMinutes', () => {
  it('returns prep only when distance is null', () => {
    expect(estimateMinutes({ distanceKm: null, prepMinutes: 20 })).toBe(20);
  });

  it('adds travel time from distance', () => {
    // 4km / 0.4 km-per-min = 10 min travel; + 20 prep = 30
    expect(estimateMinutes({ distanceKm: 4, prepMinutes: 20 })).toBe(30);
  });

  it('exposes ETA constants', () => {
    expect(AVG_SPEED_KM_PER_MIN).toBe(0.4);
    expect(DEFAULT_PREP_MINUTES).toBe(20);
  });
});

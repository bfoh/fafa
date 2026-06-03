import { describe, it, expect } from 'vitest';
import { resolveDeliveryFee } from './resolve';

const restaurant = {
  lat: 5.6037,
  lng: -0.187,
  baseFee: 10,
  freeRadiusKm: 3,
  perKmRate: 2.5,
  maxDistanceKm: null as number | null,
};

describe('resolveDeliveryFee', () => {
  it('uses an active manual zone override by name (case-insensitive)', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [{ name: 'east legon', fee: 15 }],
    });
    expect(r.source).toBe('override');
    expect(r.fee).toBe(15);
    expect(r.deliverable).toBe(true);
  });

  it('computes by distance when no override and coords + area known', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.source).toBe('distance');
    expect(r.distanceKm).not.toBeNull();
    expect(r.fee).toBeGreaterThan(restaurant.baseFee);
  });

  it('falls back to base fee when the restaurant has no coords', () => {
    const r = resolveDeliveryFee({
      restaurant: { ...restaurant, lat: null, lng: null },
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.source).toBe('base');
    expect(r.fee).toBe(10);
  });

  it('falls back to base fee when the area is not in the dataset', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'Atlantis',
      manualZones: [],
    });
    expect(r.source).toBe('base');
    expect(r.fee).toBe(10);
  });

  it('marks not deliverable beyond maxDistanceKm', () => {
    const r = resolveDeliveryFee({
      restaurant: { ...restaurant, maxDistanceKm: 1 },
      city: 'Accra',
      areaName: 'Adenta',
      manualZones: [],
    });
    expect(r.source).toBe('distance');
    expect(r.deliverable).toBe(false);
  });
});

describe('resolveDeliveryFee with a customer pin', () => {
  it('measures distance from the pin and reports distanceSource = pin', () => {
    // A pin far north-east of the restaurant; centroid would give a different number.
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('distance');
    expect(r.distanceSource).toBe('pin');
    expect(r.distanceKm).not.toBeNull();
    expect(r.breakdown).not.toBeNull();
  });

  it('uses the centroid (distanceSource = centroid) when no pin is given', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.distanceSource).toBe('centroid');
  });

  it('lets a manual override win over a pin', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [{ name: 'East Legon', fee: 15 }],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('override');
    expect(r.distanceSource).toBeNull();
    expect(r.breakdown).toBeNull();
    expect(r.fee).toBe(15);
  });

  it('computes from the pin even when the area is unknown', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'Atlantis',
      manualZones: [],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('distance');
    expect(r.distanceSource).toBe('pin');
  });
});

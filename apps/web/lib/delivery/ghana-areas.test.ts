import { describe, it, expect } from 'vitest';
import { GHANA_CITIES, findCity, findNeighborhood } from './ghana-areas';

describe('GHANA_CITIES dataset', () => {
  it('has at least one city', () => {
    expect(GHANA_CITIES.length).toBeGreaterThan(0);
  });

  it('every city has a valid centroid and >=1 neighborhood', () => {
    for (const city of GHANA_CITIES) {
      expect(city.name.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(city.lat)).toBe(true);
      expect(Number.isFinite(city.lng)).toBe(true);
      expect(city.neighborhoods.length).toBeGreaterThan(0);
    }
  });

  it('every neighborhood has coords inside Ghana bounds', () => {
    for (const city of GHANA_CITIES) {
      for (const n of city.neighborhoods) {
        expect(n.lat).toBeGreaterThanOrEqual(4.5);
        expect(n.lat).toBeLessThanOrEqual(11.5);
        expect(n.lng).toBeGreaterThanOrEqual(-3.5);
        expect(n.lng).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('neighborhood names are unique within a city (case-insensitive)', () => {
    for (const city of GHANA_CITIES) {
      const names = city.neighborhoods.map((n) => n.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('findCity is case-insensitive', () => {
    expect(findCity('accra')?.name).toBe('Accra');
    expect(findCity('NOPE')).toBeUndefined();
  });

  it('findNeighborhood matches case-insensitively', () => {
    expect(findNeighborhood('Accra', 'east legon')?.name).toBe('East Legon');
    expect(findNeighborhood('Accra', 'nowhere')).toBeUndefined();
  });
});

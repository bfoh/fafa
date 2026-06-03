// Curated Ghana cities and neighborhoods with approximate centroid coordinates.
// Single source of truth for the checkout city/neighborhood selectors AND the
// server-side delivery-fee lookup. Coordinates are approximate centroids meant
// for distance-tier pricing, not exact addressing. Expand over time.

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
}

export interface City {
  name: string;
  lat: number; // city centroid (default map / fallback)
  lng: number;
  neighborhoods: Neighborhood[];
}

export const GHANA_CITIES: City[] = [
  {
    name: 'Accra',
    lat: 5.6037,
    lng: -0.187,
    neighborhoods: [
      { name: 'Osu', lat: 5.556, lng: -0.182 },
      { name: 'Labadi', lat: 5.556, lng: -0.156 },
      { name: 'Cantonments', lat: 5.576, lng: -0.172 },
      { name: 'Airport Residential', lat: 5.605, lng: -0.176 },
      { name: 'East Legon', lat: 5.636, lng: -0.166 },
      { name: 'Spintex', lat: 5.636, lng: -0.11 },
      { name: 'Madina', lat: 5.668, lng: -0.166 },
      { name: 'Adenta', lat: 5.709, lng: -0.159 },
      { name: 'Achimota', lat: 5.619, lng: -0.227 },
      { name: 'Tesano', lat: 5.598, lng: -0.23 },
      { name: 'Lapaz', lat: 5.606, lng: -0.254 },
      { name: 'Dansoman', lat: 5.538, lng: -0.266 },
    ],
  },
  {
    name: 'Tema',
    lat: 5.6698,
    lng: -0.0166,
    neighborhoods: [
      { name: 'Community 1', lat: 5.67, lng: -0.01 },
      { name: 'Community 25', lat: 5.65, lng: 0.005 },
      { name: 'Sakumono', lat: 5.63, lng: -0.04 },
      { name: 'Ashaiman', lat: 5.689, lng: -0.033 },
    ],
  },
  {
    name: 'Kumasi',
    lat: 6.6885,
    lng: -1.6244,
    neighborhoods: [
      { name: 'Adum', lat: 6.692, lng: -1.621 },
      { name: 'Asokwa', lat: 6.668, lng: -1.601 },
      { name: 'Bantama', lat: 6.7, lng: -1.636 },
      { name: 'Ahodwo', lat: 6.668, lng: -1.628 },
      { name: 'KNUST', lat: 6.674, lng: -1.566 },
    ],
  },
  {
    name: 'Takoradi',
    lat: 4.8845,
    lng: -1.7554,
    neighborhoods: [
      { name: 'Market Circle', lat: 4.893, lng: -1.756 },
      { name: 'Anaji', lat: 4.91, lng: -1.778 },
      { name: 'Effia', lat: 4.9, lng: -1.77 },
    ],
  },
  {
    name: 'Cape Coast',
    lat: 5.1053,
    lng: -1.2466,
    neighborhoods: [
      { name: 'Pedu', lat: 5.12, lng: -1.27 },
      { name: 'OLA', lat: 5.11, lng: -1.25 },
    ],
  },
];

export function findCity(name: string): City | undefined {
  const q = name.trim().toLowerCase();
  return GHANA_CITIES.find((c) => c.name.toLowerCase() === q);
}

export function findNeighborhood(
  city: string,
  area: string
): Neighborhood | undefined {
  const c = findCity(city);
  if (!c) return undefined;
  const q = area.trim().toLowerCase();
  return c.neighborhoods.find((n) => n.name.toLowerCase() === q);
}

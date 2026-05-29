// Approximate centroids for GH cities (used to center the onboarding map).
export const CITY_COORDS: Record<string, [number, number]> = {
  Accra: [5.6037, -0.187],
  Kumasi: [6.6885, -1.6244],
  Tamale: [9.4008, -0.8393],
  Takoradi: [4.8845, -1.7554],
  'Cape Coast': [5.1053, -1.2466],
  Tema: [5.6698, -0.0166],
  Sunyani: [7.3349, -2.3123],
  Ho: [6.611, 0.471],
  Koforidua: [6.0941, -0.2591],
};

export const DEFAULT_CENTER: [number, number] = [5.6037, -0.187]; // Accra

export function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

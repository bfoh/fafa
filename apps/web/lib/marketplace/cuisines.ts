export interface Cuisine {
  slug: string;
  label: string;
  emoji: string;
}

// Single source of truth for cuisine tags (onboarding, settings, chips).
export const CUISINES: Cuisine[] = [
  { slug: 'local', label: 'Local', emoji: '🍛' },
  { slug: 'continental', label: 'Continental', emoji: '🍽️' },
  { slug: 'fast-food', label: 'Fast Food', emoji: '🍔' },
  { slug: 'grills', label: 'Grills', emoji: '🍗' },
  { slug: 'pizza', label: 'Pizza', emoji: '🍕' },
  { slug: 'chinese', label: 'Chinese', emoji: '🥡' },
  { slug: 'pastries', label: 'Pastries', emoji: '🥐' },
  { slug: 'drinks', label: 'Drinks', emoji: '🥤' },
  { slug: 'healthy', label: 'Healthy', emoji: '🥗' },
  { slug: 'breakfast', label: 'Breakfast', emoji: '🍳' },
];

export const CUISINE_LABEL: Record<string, string> = Object.fromEntries(
  CUISINES.map((c) => [c.slug, c.label])
);

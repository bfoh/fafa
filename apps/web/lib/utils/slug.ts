/**
 * Generate a URL-safe slug from a string.
 * "Mama Ama's Kitchen" → "mama-amas-kitchen"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')           // Remove apostrophes
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');          // Trim leading/trailing hyphens
}

/**
 * Check if a slug is available and generate a unique one if not.
 */
export async function generateUniqueSlug(
  name: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = generateSlug(name);
  let slug = base;
  let counter = 2;

  while (await checkExists(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }

  return slug;
}

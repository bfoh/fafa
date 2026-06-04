import type { SupabaseClient } from '@supabase/supabase-js';

export interface SampleDish {
  category: string;
  name: string;
  description: string;
  price: number;
}

// Sample Ghanaian dishes seeded into the default categories created at signup.
export const SAMPLE_MENU: SampleDish[] = [
  { category: 'Main Dishes', name: 'Jollof Rice with Chicken', description: 'Smoky party jollof served with grilled chicken', price: 45 },
  { category: 'Main Dishes', name: 'Waakye Special', description: 'Rice and beans with spaghetti, egg, gari and shito', price: 35 },
  { category: 'Main Dishes', name: 'Banku with Tilapia', description: 'Fresh grilled tilapia with hot pepper and banku', price: 50 },
  { category: 'Main Dishes', name: 'Fried Rice with Chicken', description: 'Vegetable fried rice with seasoned chicken', price: 45 },
  { category: 'Sides & Extras', name: 'Kelewele', description: 'Spicy fried ripe plantain cubes', price: 15 },
  { category: 'Sides & Extras', name: 'Fried Plantain', description: 'Golden fried ripe plantain', price: 12 },
  { category: 'Drinks', name: 'Sobolo', description: 'Chilled hibiscus drink', price: 10 },
  { category: 'Drinks', name: 'Bottled Water', description: '500ml bottled water', price: 5 },
];

/**
 * Seed the sample menu for a tenant. Idempotent: no-op if the store already has
 * items. Returns the number of dishes inserted (0 if it was already populated).
 */
export async function seedSampleMenu(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { count } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if ((count || 0) > 0) return 0;

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  if (!categories || categories.length === 0) {
    throw new Error('No menu categories found. Add a category first.');
  }

  const byName = new Map(categories.map((c) => [c.name, c.id]));
  const fallbackId = categories[0].id;

  const rows = SAMPLE_MENU.map((dish, i) => ({
    tenant_id: tenantId,
    category_id: byName.get(dish.category) ?? fallbackId,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    is_available: true,
    sort_order: i,
  }));

  const { error } = await supabase.from('menu_items').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

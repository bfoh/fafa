import { createAdminClient } from '@/lib/supabase/admin';
import type {
  KitchenResult,
  MenuPreview,
} from '@/components/marketplace/kitchen-card';

function parseNear(near?: string): { lat: number | null; lng: number | null } {
  if (!near) return { lat: null, lng: null };
  const [a, b] = near.split(',').map((n) => Number(n));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return { lat: null, lng: null };
}

/**
 * Loads marketplace kitchens (with up to 3 dish previews + ratings). Extracted
 * from the live homepage so redesign preview routes can reuse the exact same
 * data path without touching the production page.
 */
export async function loadKitchens(sp: {
  q?: string;
  cuisine?: string;
  city?: string;
  near?: string;
}): Promise<KitchenResult[]> {
  const { lat, lng } = parseNear(sp.near);

  let kitchens: KitchenResult[] = [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('search_kitchens', {
      p_q: sp.q || null,
      p_cuisines: sp.cuisine ? [sp.cuisine] : null,
      p_city: sp.city || null,
      p_lat: lat,
      p_lng: lng,
      p_limit: 24,
      p_offset: 0,
    });
    if (error) throw error;
    kitchens = (data as KitchenResult[]) || [];
  } catch (err) {
    console.error('Marketplace load failed:', err);
    return [];
  }

  if (kitchens.length === 0) return kitchens;

  try {
    const supabase = createAdminClient();
    const { data: items } = await supabase
      .from('menu_items')
      .select('tenant_id, name, price, image_url, is_featured, sort_order, is_chop_bar')
      .in('tenant_id', kitchens.map((k) => k.id))
      .eq('is_available', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });

    const byTenant = new Map<string, MenuPreview[]>();
    for (const it of items || []) {
      const arr = byTenant.get(it.tenant_id) || [];
      if (arr.length < 3) {
        arr.push({
          name: it.name,
          price: Number(it.price),
          image_url: it.image_url,
          is_chop_bar: Boolean(it.is_chop_bar),
        });
        byTenant.set(it.tenant_id, arr);
      }
    }

    const { data: ratings } = await supabase
      .from('tenants')
      .select('id, rating_avg, rating_count')
      .in('id', kitchens.map((k) => k.id));
    const ratingById = new Map(
      (ratings || []).map((r) => [
        r.id,
        { avg: Number(r.rating_avg) || 0, count: Number(r.rating_count) || 0 },
      ])
    );

    kitchens = kitchens.map((k) => ({
      ...k,
      items: byTenant.get(k.id) || [],
      rating_avg: ratingById.get(k.id)?.avg ?? 0,
      rating_count: ratingById.get(k.id)?.count ?? 0,
    }));
  } catch (err) {
    console.error('Dish preview load failed:', err);
  }

  return kitchens;
}

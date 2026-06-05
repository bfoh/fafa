import type { SupabaseClient } from '@supabase/supabase-js';

export async function searchMenu(
  supabase: SupabaseClient,
  tenantId: string | null,
  args: { query?: string; maxPrice?: number }
) {
  let q = supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .limit(8);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  if (args.query) q = q.ilike('name', `%${args.query}%`);
  if (typeof args.maxPrice === 'number') q = q.lte('price', args.maxPrice);
  const { data } = await q;
  return (data || []).map((d) => ({
    id: d.id,
    name: d.name,
    price: Number(d.price),
    description: d.description,
    image: d.image_url,
    isChopBar: (d as { is_chop_bar?: boolean }).is_chop_bar ?? false,
  }));
}

export async function checkHours(supabase: SupabaseClient, tenantId: string) {
  const today = new Date().getDay();
  const { data } = await supabase
    .from('operating_hours')
    .select('open_time, close_time, is_closed')
    .eq('tenant_id', tenantId)
    .eq('day_of_week', today)
    .maybeSingle();
  if (!data || data.is_closed) return { open: false };
  return { open: true, opens: data.open_time, closes: data.close_time };
}

export async function trackOrder(supabase: SupabaseClient, ref: string) {
  const byNumber = ref.toUpperCase().startsWith('FA-');
  const { data } = await supabase
    .from('orders')
    .select('order_number, status, delivery_type, total, estimated_ready_at, created_at')
    .eq(byNumber ? 'order_number' : 'id', byNumber ? ref.toUpperCase() : ref)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { found: false };
  return {
    found: true,
    orderNumber: data.order_number,
    status: data.status,
    deliveryType: data.delivery_type,
    total: Number(data.total),
    estimatedReadyAt: data.estimated_ready_at,
  };
}

export async function findKitchens(
  supabase: SupabaseClient,
  args: { query?: string; city?: string }
) {
  const { data } = await supabase.rpc('search_kitchens', {
    p_q: args.query || null,
    p_city: args.city || null,
    p_limit: 6,
  });
  return (data || []).map(
    (k: { name: string; slug: string; delivery_fee: number; open_now: boolean }) => ({
      name: k.name,
      slug: k.slug,
      deliveryFee: Number(k.delivery_fee),
      openNow: k.open_now,
    })
  );
}

export async function getRecommendations(supabase: SupabaseClient, tenantId: string | null) {
  let q = supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .order('is_featured', { ascending: false })
    .limit(5);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q;
  return (data || []).map((d) => ({
    id: d.id,
    name: d.name,
    price: Number(d.price),
    description: (d as { description?: string }).description ?? null,
    image: (d as { image_url?: string }).image_url ?? null,
    isChopBar: (d as { is_chop_bar?: boolean }).is_chop_bar ?? false,
  }));
}

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

function parseNear(near?: string): { lat: number | null; lng: number | null } {
  if (!near) return { lat: null, lng: null };
  const [a, b] = near.split(',').map((n) => Number(n));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return { lat: null, lng: null };
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || undefined;
    const cuisine = searchParams.get('cuisine') || undefined;
    const city = searchParams.get('city') || undefined;
    const near = searchParams.get('near') || undefined;

    const { lat, lng } = parseNear(near);

    const supabase = createAdminClient();
    const { data: kitchensData, error: kitchensError } = await supabase.rpc('search_kitchens', {
      p_q: q || null,
      p_cuisines: cuisine ? [cuisine] : null,
      p_city: city || null,
      p_lat: lat,
      p_lng: lng,
      p_limit: 24,
      p_offset: 0,
    });

    if (kitchensError) throw kitchensError;
    let kitchens = kitchensData || [];

    if (kitchens.length > 0) {
      // Attach up to 3 dishes per kitchen
      const { data: items } = await supabase
        .from('menu_items')
        .select('tenant_id, name, price, image_url, is_featured, sort_order, is_chop_bar')
        .in(
          'tenant_id',
          kitchens.map((k: any) => k.id)
        )
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true });

      const byTenant = new Map<string, any[]>();
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

      // Ratings
      const { data: ratings } = await supabase
        .from('tenants')
        .select('id, rating_avg, rating_count')
        .in('id', kitchens.map((k: any) => k.id));
      const ratingById = new Map(
        (ratings || []).map((r) => [r.id, { avg: Number(r.rating_avg) || 0, count: Number(r.rating_count) || 0 }])
      );

      kitchens = kitchens.map((k: any) => ({
        ...k,
        items: byTenant.get(k.id) || [],
        rating_avg: ratingById.get(k.id)?.avg ?? 0,
        rating_count: ratingById.get(k.id)?.count ?? 0,
      }));
    }

    return NextResponse.json({ kitchens }, { headers });
  } catch (err) {
    console.error('API marketplace load failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

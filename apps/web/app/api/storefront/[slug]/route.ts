import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';
import type {
  StorefrontPayload,
  StorefrontCategory,
} from '@/lib/storefront/payload';

/* ── Public storefront payload ──────────────────────────────
   Moves the service-role tenant/menu/zone queries (previously inline in the
   (storefront)/[slug] server page + layout) behind an API the mobile static
   bundle can fetch. The SUPABASE_SERVICE_ROLE_KEY never leaves the server.
   Public read — no auth (tenants/menus are public by design). */

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { slug } = await ctx.params;
    const supabase = createAdminClient();

    // 1. Tenant (active only)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404, headers }
      );
    }

    // 2. Menu categories with nested items + options
    const { data: categories } = await supabase
      .from('menu_categories')
      .select(
        `
        id,
        name,
        sort_order,
        menu_items (
          *,
          menu_item_options ( * )
        )
      `
      )
      .eq('tenant_id', tenant.id)
      .order('sort_order');

    // 3. Active delivery zones
    const { data: deliveryZones } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name');

    // 4. Keep available items only, sort, drop empty categories
    //    (identical filtering to the former server page).
    const menuCategories: StorefrontCategory[] = (categories || [])
      .map((cat: any) => ({
        ...cat,
        menu_items: (cat.menu_items || [])
          .filter((item: any) => item.is_available)
          .sort((a: any, b: any) => a.sort_order - b.sort_order),
      }))
      .filter((cat: any) => cat.menu_items.length > 0);

    const payload: StorefrontPayload = {
      tenant,
      menuCategories,
      deliveryZones: deliveryZones || [],
    };

    return NextResponse.json(payload, {
      headers: {
        ...headers,
        // Edge stale-while-revalidate: fast repeat loads, silent refresh.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('storefront payload failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

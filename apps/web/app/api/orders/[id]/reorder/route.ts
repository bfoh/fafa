import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/* ── Reorder (public-by-UUID, same trust model as the tracker page) ──
   Rebuilds the order's items as cart entries validated against the CURRENT
   menu: deleted/unavailable items are skipped, names/prices/images refresh
   from the live menu (chop-bar bowls keep their customer-built price), and
   option snapshots carry over so the meal recreates exactly. */

export const dynamic = 'force-dynamic';

interface StoredOption {
  name: string;
  priceModifier?: number;
  price_modifier?: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select(
        'id, tenant_id, tenant:tenants(slug), order_items ( menu_item_id, item_name, unit_price, quantity, options_json )'
      )
      .eq('id', id)
      .single();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    type OrderItemRow = {
      menu_item_id: string | null;
      item_name: string;
      unit_price: number;
      quantity: number;
      options_json: StoredOption[] | null;
    };
    const orderItems = (order.order_items || []) as OrderItemRow[];

    const menuItemIds = orderItems
      .map((i) => i.menu_item_id)
      .filter((x): x is string => !!x);
    const { data: menuItems } = menuItemIds.length
      ? await admin
          .from('menu_items')
          .select('id, name, price, image_url, is_available, is_chop_bar')
          .in('id', menuItemIds)
          .eq('tenant_id', order.tenant_id)
      : { data: [] };

    const items: Array<{
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
      options: { name: string; priceModifier: number }[];
      imageUrl: string | null;
    }> = [];
    const skipped: string[] = [];

    for (const item of orderItems) {
      const menuItem = (menuItems || []).find((m) => m.id === item.menu_item_id);
      if (!menuItem || !menuItem.is_available) {
        skipped.push(item.item_name);
        continue;
      }
      items.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        // Chop-bar bowls are customer-priced — keep the built price (order
        // creation re-floors it at the configured base). Normal items take
        // the live menu price so the cart shows what will be charged.
        price: menuItem.is_chop_bar ? Number(item.unit_price) : Number(menuItem.price),
        quantity: item.quantity,
        options: (item.options_json || []).map((o) => ({
          name: o.name,
          priceModifier: Number(o.priceModifier ?? o.price_modifier ?? 0),
        })),
        imageUrl: menuItem.image_url || null,
      });
    }

    const tenant = order.tenant as unknown as { slug: string } | null;
    return NextResponse.json({ slug: tenant?.slug || null, items, skipped });
  } catch (err) {
    console.error('Failed to build reorder cart:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

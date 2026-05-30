import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { formatGHS } from '@/lib/utils/currency';
import { StorefrontMenu } from '@/components/storefront/storefront-menu';

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!tenant) notFound();

  // Fetch menu items grouped by category
  const { data: categories } = await supabase
    .from('menu_categories')
    .select(`
      id,
      name,
      sort_order,
      menu_items (
        *,
        menu_item_options (
          id,
          name,
          price_modifier
        )
      )
    `)
    .eq('tenant_id', tenant.id)
    .order('sort_order');

  // Fetch delivery zones
  const { data: deliveryZones } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name');

  // Filter to only available items
  const menuCategories = (categories || [])
    .map((cat) => ({
      ...cat,
      menu_items: ((cat.menu_items as unknown as Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        image_url: string | null;
        is_available: boolean;
        is_featured: boolean;
        sort_order: number;
        is_chop_bar?: boolean;
        menu_item_options: Array<{
          id: string;
          name: string;
          price_modifier: number;
        }>;
      }>) || [])
        .filter((item) => item.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((cat) => cat.menu_items.length > 0);

  return (
    <div className="max-w-lg mx-auto">
      {/* Cover image */}
      {tenant.cover_image_url && (
        <div className="h-40 relative overflow-hidden">
          <img
            src={tenant.cover_image_url}
            alt={tenant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Restaurant info */}
      <div className="px-4 pt-5 pb-3">
        {tenant.description && (
          <p className="text-sm text-surface-600">{tenant.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
          {tenant.city && <span>📍 {tenant.city}</span>}
          {tenant.accepts_delivery && (
            <span>🚗 Delivery {tenant.delivery_fee > 0 ? `from ${formatGHS(Number(tenant.delivery_fee))}` : 'available'}</span>
          )}
          {tenant.accepts_pickup && <span>🏪 Pickup</span>}
        </div>
      </div>

      {/* Menu */}
      <StorefrontMenu
        categories={menuCategories}
        tenant={{
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          delivery_fee: Number(tenant.delivery_fee),
          min_order_amount: Number(tenant.min_order_amount),
          accepts_delivery: tenant.accepts_delivery,
          accepts_pickup: tenant.accepts_pickup,
          accepts_pay_online: tenant.accepts_pay_online,
          accepts_pay_on_delivery: tenant.accepts_pay_on_delivery,
          primary_color: tenant.primary_color || '#FF6B35',
        }}
        deliveryZones={deliveryZones || []}
      />
    </div>
  );
}

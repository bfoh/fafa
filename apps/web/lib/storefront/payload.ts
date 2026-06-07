/**
 * Shared response shapes for the mobile storefront API. Lives in apps/web (the
 * backend) and is consumed by apps/mobile via cross-alias (`@/lib/storefront/payload`).
 * Service-role queries that build these stay server-side; the client only ever
 * sees the serialised payload.
 */

export interface StorefrontMenuOption {
  id: string;
  name: string;
  price_modifier: number;
  option_type?: string;
  sub_options?: string | null;
  min_quantity?: number;
}

export interface StorefrontMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  is_chop_bar?: boolean;
  menu_item_options: StorefrontMenuOption[];
}

export interface StorefrontCategory {
  id: string;
  name: string;
  sort_order: number;
  menu_items: StorefrontMenuItem[];
}

/** Full tenant row (branding, flags, contact). Loosely typed — the client picks fields. */
export type StorefrontTenant = Record<string, unknown> & {
  id: string;
  slug: string;
  name: string;
};

export interface StorefrontPayload {
  tenant: StorefrontTenant;
  menuCategories: StorefrontCategory[];
  deliveryZones: unknown[];
}

/** Minimal tenant contact for the order tracker. */
export interface OrderTenantContact {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  primary_color: string;
}

export interface OrderTrackingPayload {
  order: unknown;
  history: Array<{ to_status: string; created_at: string }>;
  tenant: OrderTenantContact;
  paid: boolean;
}

export interface VerifyResult {
  paid: boolean;
  status: 'paid' | 'pending' | 'cash_on_delivery' | 'not_found';
}

// ─── Menu Types ─────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_chop_bar?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;

  // Relations (optional, when joined)
  category?: MenuCategory;
  options?: MenuItemOption[];
  daily?: DailyMenu;
}

export interface MenuItemOption {
  id: string;
  menu_item_id: string;
  name: string;
  price_modifier: number;
  created_at: string;
}

export interface DailyMenu {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  date: string;
  is_available: boolean;
  quantity_limit: number | null;
  quantity_sold: number;
}

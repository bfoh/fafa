'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatGHS } from '@/lib/utils/currency';
import {
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  Sparkles,
  Search,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

/* ─── Types ─────────────────────────────────────────────── */

type OptionType = 'soup' | 'protein' | 'extra';

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItemOption {
  id?: string;
  name: string;
  price_modifier: number;
  option_type: OptionType;
  sub_options?: string | null;
  min_quantity?: number;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_chop_bar?: boolean;
  menu_item_options: MenuItemOption[];
}

/* ─── Option-type metadata ──────────────────────────────── */

interface OptionTypeMeta {
  label: string;
  emoji: string;
  /** Plain-language explanation of what the customer experiences. */
  hint: string;
  /** Selected type-card styling. */
  sel: string;
  /** Grouped-list card styling. */
  group: string;
  /** Count-badge styling. */
  badge: string;
}

const OPTION_TYPE_META: Record<OptionType, OptionTypeMeta> = {
  soup: {
    label: 'Soup',
    emoji: '🍲',
    hint: 'Free choice — the customer picks a soup at no extra cost.',
    sel: 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-400/30',
    group: 'bg-amber-50 border-amber-200 text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  protein: {
    label: 'Protein',
    emoji: '🥩',
    hint: 'Customer sets the amount in GH₵. Add a minimum and list types (e.g. Tilapia, Salmon).',
    sel: 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-400/30',
    group: 'bg-rose-50 border-rose-200 text-rose-800',
    badge: 'bg-rose-100 text-rose-700',
  },
  extra: {
    label: 'Extra',
    emoji: '🥚',
    hint: 'Fixed-price add-on (e.g. Extra Egg +GH₵5). Leave price 0 to include it free.',
    sel: 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-400/30',
    group: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-700',
  },
};

const OPTION_TYPE_ORDER: OptionType[] = ['soup', 'protein', 'extra'];

/* ─── Type inference for legacy / mis-saved options ─────────
   Older options were saved before option_type persisted, so they
   default to 'extra'. Re-classify well-known chop-bar names, but
   only when the stored type is the default AND the option is free
   (priced extras like Wele +5 / Egg +5 are intentionally extras). */

const KNOWN_SOUPS = new Set([
  'light soup', 'abunabunu soup', 'peanut soup', 'palm nut soup',
  'groundnut soup', 'okro soup', 'okra soup', 'green green', 'nkrakra',
]);
const KNOWN_PROTEINS = new Set([
  'goat meat', 'beef', 'chicken', 'fish', 'mutton', 'turkey',
  'cow leg', 'cow foot', 'gizzard',
]);

function inferOptionType(name: string, stored: OptionType, price: number): OptionType {
  if (stored !== 'extra' || price > 0) return stored;
  const n = name.trim().toLowerCase();
  if (KNOWN_SOUPS.has(n) || n.endsWith(' soup') || n === 'soup') return 'soup';
  if (KNOWN_PROTEINS.has(n)) return 'protein';
  return 'extra';
}

/* ─── Sub-type helpers ──────────────────────────────────── */

function parseSubs(raw?: string | null): string[] {
  return (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function joinSubs(list: string[]): string | null {
  return list.length ? list.join(', ') : null;
}

/* ─── Chop Bar default options ──────────────────────────── */

const CHOP_BAR_DEFAULTS: MenuItemOption[] = [
  { name: 'Light Soup',       price_modifier: 0, option_type: 'soup',    min_quantity: 0 },
  { name: 'Abunabunu Soup',   price_modifier: 0, option_type: 'soup',    min_quantity: 0 },
  { name: 'Peanut Soup',      price_modifier: 0, option_type: 'soup',    min_quantity: 0 },
  { name: 'Palm Nut Soup',    price_modifier: 0, option_type: 'soup',    min_quantity: 0 },
  { name: 'Goat Meat',        price_modifier: 0, option_type: 'protein', min_quantity: 10, sub_options: null },
  { name: 'Beef',             price_modifier: 0, option_type: 'protein', min_quantity: 10, sub_options: null },
  { name: 'Chicken',          price_modifier: 0, option_type: 'protein', min_quantity: 10, sub_options: null },
  { name: 'Fish',             price_modifier: 0, option_type: 'protein', min_quantity: 10, sub_options: 'Tilapia, Salmon, Catfish' },
  { name: 'Wele',             price_modifier: 5, option_type: 'extra',   min_quantity: 0 },
  { name: 'Egg',              price_modifier: 5, option_type: 'extra',   min_quantity: 0 },
];

/* ─── Component ─────────────────────────────────────────── */

export default function MenuPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Category Form
  const [categoryName, setCategoryName] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Item Form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFeatured, setItemFeatured] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  const [itemOptions, setItemOptions] = useState<MenuItemOption[]>([]);
  const [itemFormLoading, setItemFormLoading] = useState(false);
  const [itemIsChopBar, setItemIsChopBar] = useState(false);

  // New option form
  const [newOptName, setNewOptName] = useState('');
  const [newOptPrice, setNewOptPrice] = useState('');
  const [newOptType, setNewOptType] = useState<OptionType>('soup');
  const [newOptSubs, setNewOptSubs] = useState<string[]>([]);
  const [subDraft, setSubDraft] = useState('');
  const [newOptMinQty, setNewOptMinQty] = useState('');

  // DB feature detection
  const [dbHasChopBarColumn, setDbHasChopBarColumn] = useState(false);

  // Option editor UI state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function loadSessionAndData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const tId = await getResolvedTenantIdClient(supabase, session);
      if (tId) {
        setTenantId(tId);
        fetchMenuData(tId);
      }
    }

    loadSessionAndData();
  }, []);

  async function fetchMenuData(tId: string) {
    setLoading(true);
    try {
      // 1. Fetch categories
      const { data: cats, error: catsErr } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('tenant_id', tId)
        .order('sort_order', { ascending: true });

      if (catsErr) throw catsErr;
      setCategories(cats || []);

      // 2. Fetch items with options
      const { data: items, error: itemsErr } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_options (
            *
          )
        `)
        .eq('tenant_id', tId)
        .order('sort_order', { ascending: true });

      if (itemsErr) throw itemsErr;

      // Detect if is_chop_bar exists in database schema
      if (items && items.length > 0) {
        setDbHasChopBarColumn('is_chop_bar' in items[0]);
      } else {
        const { error: testErr } = await supabase
          .from('menu_items')
          .select('is_chop_bar')
          .limit(1);
        setDbHasChopBarColumn(!testErr);
      }

      const formattedItems = (items || []).map((item: any) => {
        const seen = new Set<string>();
        const options = (item.menu_item_options || [])
          .map((opt: any) => {
            const price = Number(opt.price_modifier) || 0;
            return {
              ...opt,
              price_modifier: price,
              option_type: inferOptionType(opt.name, (opt.option_type as OptionType) || 'extra', price),
              sub_options: opt.sub_options || null,
              min_quantity: Number(opt.min_quantity) || 0,
            };
          })
          // Collapse exact duplicates left over from repeated default loads
          .filter((opt: MenuItemOption) => {
            const key = `${opt.name.toLowerCase()}|${opt.option_type}|${opt.price_modifier}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        return { ...item, price: Number(item.price), menu_item_options: options };
      });

      setMenuItems(formattedItems);
    } catch (err) {
      console.error('Error fetching menu data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Toggles item availability quickly
  async function toggleAvailability(itemId: string, currentStatus: boolean) {
    const updatedStatus = !currentStatus;
    
    // Optimistic update
    setMenuItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_available: updatedStatus } : item
      )
    );

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: updatedStatus })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle availability:', err);
      // Revert on error
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_available: currentStatus } : item
        )
      );
    }
  }

  // Handles Category Creation
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName.trim() || !tenantId) return;

    setCategoryLoading(true);
    try {
      const nextSortOrder = categories.length;
      const { data, error } = await supabase
        .from('menu_categories')
        .insert({
          tenant_id: tenantId,
          name: categoryName.trim(),
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories((prev) => [...prev, data]);
      setCategoryName('');
      setCategoryModalOpen(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setCategoryLoading(false);
    }
  }

  // Handles Category Deletion
  async function handleDeleteCategory(catId: string) {
    if (!confirm('Are you sure you want to delete this category? All items inside will be uncategorized.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;

      setCategories((prev) => prev.filter((c) => c.id !== catId));
      if (activeCategory === catId) {
        setActiveCategory('all');
      }
      // Re-fetch since items category_id was changed set null
      if (tenantId) fetchMenuData(tenantId);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }

  // Set up Item Form for creating new
  function openNewItemModal() {
    setSelectedItem(null);
    setItemName('');
    setItemPrice('');
    setItemCategoryId(categories[0]?.id || '');
    setItemDescription('');
    setItemFeatured(false);
    setItemAvailable(true);
    setItemImageFile(null);
    setItemImageUrl(null);
    setItemOptions([]);
    resetNewOptionForm();
    setItemIsChopBar(false);
    setEditingIdx(null);
    setShowPreview(false);
    setItemModalOpen(true);
  }

  // Set up Item Form for editing existing
  function openEditItemModal(item: MenuItem) {
    setSelectedItem(item);
    setItemName(item.name);
    setItemPrice(item.price.toString());
    setItemCategoryId(item.category_id || '');
    setItemDescription(item.description || '');
    setItemFeatured(item.is_featured);
    setItemAvailable(item.is_available);
    setItemImageFile(null);
    setItemImageUrl(item.image_url);
    setItemOptions(item.menu_item_options || []);
    resetNewOptionForm();
    setItemIsChopBar(item.is_chop_bar ?? false);
    setEditingIdx(null);
    setShowPreview(false);
    setItemModalOpen(true);
  }

  function resetNewOptionForm() {
    setNewOptName('');
    setNewOptPrice('');
    setNewOptType('soup');
    setNewOptSubs([]);
    setSubDraft('');
    setNewOptMinQty('');
  }

  // Adds an option to the local options array in the form
  function addLocalOption() {
    if (!newOptName.trim()) return;
    const type: OptionType = itemIsChopBar ? newOptType : 'extra';
    // Fold any unconfirmed draft text into the chip list first
    const draftParts = subDraft.split(',').map((s) => s.trim()).filter(Boolean);
    const subs = [...newOptSubs, ...draftParts.filter((p) => !newOptSubs.some((s) => s.toLowerCase() === p.toLowerCase()))];
    const price = type === 'soup' ? 0 : parseFloat(newOptPrice) || 0;
    const minQty = type === 'protein' ? parseFloat(newOptMinQty) || 0 : 0;
    setItemOptions((prev) => [
      ...prev,
      {
        name: newOptName.trim(),
        price_modifier: price,
        option_type: type,
        sub_options: joinSubs(subs),
        min_quantity: minQty,
      },
    ]);
    resetNewOptionForm();
  }

  // Removes an option from the local options array in the form
  function removeLocalOption(index: number) {
    setItemOptions((prev) => prev.filter((_, i) => i !== index));
    setEditingIdx((cur) => (cur === index ? null : cur));
  }

  // Patches an existing option in place (used by inline editing)
  function updateLocalOption(index: number, patch: Partial<MenuItemOption>) {
    setItemOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt))
    );
  }

  function loadChopBarDefaults() {
    setItemOptions((prev) => {
      const existingNames = new Set(prev.map((o) => o.name.toLowerCase()));
      const toAdd = CHOP_BAR_DEFAULTS.filter((d) => !existingNames.has(d.name.toLowerCase()));
      return [...prev, ...toAdd];
    });
  }

  // Handles Item Add/Edit submit
  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice || !tenantId) return;

    setItemFormLoading(true);
    try {
      let finalImageUrl = itemImageUrl;

      // 1. Image upload if new file is selected
      if (itemImageFile) {
        const fileExt = itemImageFile.name.split('.').pop();
        const fileName = `${tenantId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('menu-images')
          .upload(fileName, itemImageFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);

        finalImageUrl = publicUrl;
      }

      const itemPayload: any = {
        tenant_id: tenantId,
        category_id: itemCategoryId || null,
        name: itemName.trim(),
        description: itemDescription.trim() || null,
        price: parseFloat(itemPrice) || 0,
        image_url: finalImageUrl,
        is_available: itemAvailable,
        is_featured: itemFeatured,
      };

      if (dbHasChopBarColumn) {
        itemPayload.is_chop_bar = itemIsChopBar;
      }

      let itemId = selectedItem?.id;

      if (selectedItem) {
        // Edit Mode
        const { error } = await supabase
          .from('menu_items')
          .update(itemPayload)
          .eq('id', selectedItem.id);

        if (error) throw error;

        // Delete all options first, then re-insert (simple option sync)
        await supabase
          .from('menu_item_options')
          .delete()
          .eq('menu_item_id', selectedItem.id);
      } else {
        // Create Mode
        const { data: newItem, error } = await supabase
          .from('menu_items')
          .insert(itemPayload)
          .select()
          .single();

        if (error) throw error;
        itemId = newItem.id;
      }

      // 2. Insert item options if any
      if (itemOptions.length > 0 && itemId) {
        const optionsPayload = itemOptions.map((opt) => ({
          menu_item_id: itemId,
          name: opt.name,
          price_modifier: opt.price_modifier,
          option_type: opt.option_type || 'extra',
          min_quantity: opt.min_quantity || 0,
          sub_options: opt.sub_options || null,
        }));

        const { error: optErr } = await supabase
          .from('menu_item_options')
          .insert(optionsPayload);

        if (optErr) throw optErr;
      }

      // Reload
      await fetchMenuData(tenantId);
      setItemModalOpen(false);
    } catch (err) {
      console.error('Failed to save item:', err);
    } finally {
      setItemFormLoading(false);
    }
  }

  // Delete Menu Item
  async function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.category_id === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });


  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-500" />
            Menu Management
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            Build your menu, organize items by category, and toggle availability.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-4 py-2 border border-surface-200 text-surface-700 font-semibold rounded-xl text-sm hover:bg-surface-50 transition-colors"
          >
            Manage Categories
          </button>
          <button
            onClick={openNewItemModal}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-2xl border border-surface-100 p-4 shadow-sm">
            <h2 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">
              Categories
            </h2>
            <div className="space-y-1">
              <button
                onClick={() => setActiveCategory('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                  activeCategory === 'all'
                    ? 'bg-brand-500/10 text-brand-600'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                }`}
              >
                <span>All Items</span>
                <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-500">
                  {menuItems.length}
                </span>
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter((i) => i.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between group ${
                      activeCategory === cat.id
                        ? 'bg-brand-500/10 text-brand-600'
                        : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-500 group-hover:bg-surface-200 transition-colors">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes, drinks, extras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all text-sm shadow-sm"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-surface-100 rounded-2xl shadow-sm">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              <p className="text-sm text-surface-500 mt-2">Loading menu items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-white border border-surface-100 rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                🍽️
              </div>
              <p className="text-surface-500 font-medium">No dishes found</p>
              <p className="text-sm text-surface-400 mt-1">
                {searchQuery
                  ? "We couldn't find anything matching your search."
                  : 'Start adding items to compile your menu.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={openNewItemModal}
                  className="mt-4 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl text-sm hover:bg-brand-600 transition-colors"
                >
                  Create First Item
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                    item.is_available ? 'border-surface-100' : 'border-surface-200 opacity-75'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Item Image */}
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-brand-500/5 flex items-center justify-center text-3xl flex-shrink-0">
                        🍽️
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-surface-950 text-sm truncate">
                          {item.name}
                        </h3>
                        <div className="flex gap-1 shrink-0">
                          {item.is_chop_bar && (
                            <span className="bg-success-500/10 text-success-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              CHOP BAR
                            </span>
                          )}
                          {item.is_featured && (
                            <span className="bg-brand-500/10 text-brand-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              POPULAR
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-surface-500 line-clamp-2 mt-0.5">
                        {item.description || 'No description provided.'}
                      </p>
                      <p className="text-sm font-bold text-brand-500 mt-1">
                        {formatGHS(item.price)}
                      </p>
                      {/* Show option count badge */}
                      {item.menu_item_options.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {(() => {
                            const s = item.menu_item_options.filter(o => o.option_type === 'soup').length;
                            const p = item.menu_item_options.filter(o => o.option_type === 'protein').length;
                            const e = item.menu_item_options.filter(o => o.option_type === 'extra' || !o.option_type).length;
                            return (
                              <>
                                {s > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">🍲 {s} soup{s > 1 ? 's' : ''}</span>}
                                {p > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">🥩 {p} protein{p > 1 ? 's' : ''}</span>}
                                {e > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">🥚 {e} extra{e > 1 ? 's' : ''}</span>}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-surface-100 mt-4 pt-3 flex items-center justify-between">
                    {/* Availability toggle */}
                    <button
                      onClick={() => toggleAvailability(item.id, item.is_available)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        item.is_available
                          ? 'bg-success-500/10 text-success-700 hover:bg-success-500/20'
                          : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                      }`}
                    >
                      {item.is_available ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Available
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Sold Out
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditItemModal(item)}
                        className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-50 rounded-xl transition-all"
                        title="Edit Item"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-surface-400 hover:text-error-600 hover:bg-error-50 rounded-xl transition-all"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Management Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="text-lg font-bold text-surface-900">Manage Categories</h2>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Category Name (e.g. Desserts)"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                  className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={categoryLoading}
                  className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                >
                  {categoryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </button>
              </form>

              <div className="divide-y divide-surface-100 max-h-60 overflow-y-auto pr-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-surface-800">{cat.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 text-surface-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal / Slide-over Drawer */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-slide-left">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="text-lg font-bold text-surface-900">
                {selectedItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h2>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>

            <form onSubmit={handleItemSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
              {/* Basic Fields */}
              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                  Dish Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assorted Jollof with Goat Meat"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                    {itemIsChopBar ? 'Minimum Price (GH₵)' : 'Price (GH₵)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={itemIsChopBar ? "Min e.g. 20" : "45.00"}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm"
                  />
                  {itemIsChopBar && (
                    <p className="text-[10px] text-surface-400 mt-1">
                      This is the minimum amount a customer must order for this item.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                    Category
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm"
                  >
                    <option value="">Select a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Tell your customers what goes into this meal..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm resize-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                  Dish Photo
                </label>
                <div className="flex items-center gap-4">
                  {itemImageUrl ? (
                    <img
                      src={itemImageUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-xl object-cover border border-surface-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-surface-50 border-2 border-dashed border-surface-200 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-surface-400" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setItemImageFile(file);
                        setItemImageUrl(URL.createObjectURL(file));
                      }
                    }}
                    className="text-xs text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20 file:cursor-pointer"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemFeatured}
                    onChange={(e) => setItemFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500/40 border-surface-300"
                  />
                  <span className="text-sm font-semibold text-surface-700">Mark as Popular</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500/40 border-surface-300"
                  />
                  <span className="text-sm font-semibold text-surface-700">In Stock</span>
                </label>

                {dbHasChopBarColumn && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsChopBar}
                      onChange={(e) => setItemIsChopBar(e.target.checked)}
                      className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500/40 border-surface-300"
                    />
                    <span className="text-sm font-semibold text-surface-700">Chop Bar Style</span>
                  </label>
                )}
              </div>

              {/* ════════════════════════════════════════════════
                  OPTIONS MANAGER — guided, categorized builder
                  ════════════════════════════════════════════════ */}
              <div className="border-t border-surface-100 pt-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-surface-800">
                      {itemIsChopBar ? 'Chop Bar Options' : 'Add-ons & Extras'}
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {itemIsChopBar
                        ? 'Let customers build their plate — pick a soup, choose proteins by amount, and add extras.'
                        : 'Add customizations for this dish (e.g. Extra egg +GH₵ 3).'}
                    </p>
                  </div>
                  {itemIsChopBar && (
                    <button
                      type="button"
                      onClick={loadChopBarDefaults}
                      className="px-3 py-1.5 bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Load Defaults
                    </button>
                  )}
                </div>

                {/* ── Add new option ── */}
                {(() => {
                  const effType: OptionType = itemIsChopBar ? newOptType : 'extra';
                  const meta = OPTION_TYPE_META[effType];
                  return (
                    <div className="bg-surface-50 border border-surface-100 rounded-2xl p-4 space-y-3.5">
                      <p className="text-[10px] font-extrabold text-surface-400 uppercase tracking-widest">
                        Add New Option
                      </p>

                      {/* Type picker (chop bar only) */}
                      {itemIsChopBar && (
                        <div className="grid grid-cols-3 gap-2">
                          {OPTION_TYPE_ORDER.map((t) => {
                            const m = OPTION_TYPE_META[t];
                            const active = newOptType === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setNewOptType(t)}
                                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                                  active ? m.sel : 'bg-white border-surface-200 text-surface-500 hover:bg-surface-100'
                                }`}
                              >
                                <span className="text-lg leading-none">{m.emoji}</span>
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Plain-language explanation of the selected type */}
                      <p className="text-[11px] text-surface-500 leading-snug bg-white border border-surface-100 rounded-lg px-3 py-2">
                        {meta.hint}
                      </p>

                      {/* Name */}
                      <input
                        type="text"
                        placeholder={
                          effType === 'soup' ? 'Soup name (e.g. Light Soup)'
                          : effType === 'protein' ? 'Protein name (e.g. Fish, Goat Meat)'
                          : 'Add-on name (e.g. Extra Egg)'
                        }
                        value={newOptName}
                        onChange={(e) => setNewOptName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addLocalOption(); }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm"
                      />

                      {/* Adaptive fields */}
                      {effType === 'soup' && (
                        <p className="text-[11px] text-surface-400 italic">Included free — no price needed.</p>
                      )}

                      {effType === 'protein' && (
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Minimum amount (GH₵)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g. 10 — smallest portion a customer can buy"
                              value={newOptMinQty}
                              onChange={(e) => setNewOptMinQty(e.target.value)}
                              className="w-full mt-1 px-3.5 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Types (optional)</label>
                            <SubTypeChips subs={newOptSubs} setSubs={setNewOptSubs} draft={subDraft} setDraft={setSubDraft} placeholder="e.g. Tilapia — press Enter" />
                          </div>
                        </div>
                      )}

                      {effType === 'extra' && (
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Price (GH₵)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g. 5 — leave 0 to include free"
                              value={newOptPrice}
                              onChange={(e) => setNewOptPrice(e.target.value)}
                              className="w-full mt-1 px-3.5 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Types (optional)</label>
                            <SubTypeChips subs={newOptSubs} setSubs={setNewOptSubs} draft={subDraft} setDraft={setSubDraft} placeholder="e.g. Spicy — press Enter" />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addLocalOption}
                        disabled={!newOptName.trim()}
                        className="w-full py-2.5 bg-brand-500 text-white hover:bg-brand-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Add {meta.label}
                      </button>
                    </div>
                  );
                })()}

                {/* ── Configured options (grouped, inline-editable) ── */}
                {itemOptions.length === 0 ? (
                  <div className="text-center py-8 bg-surface-50/60 border border-dashed border-surface-200 rounded-2xl">
                    <p className="text-sm text-surface-400 font-medium">No options yet</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {itemIsChopBar ? 'Add options above or tap “Load Defaults”.' : 'Add a customization above.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {OPTION_TYPE_ORDER.map((type) => {
                      const entries = itemOptions
                        .map((o, i) => ({ o, i }))
                        .filter((e) => e.o.option_type === type);
                      if (entries.length === 0) return null;
                      return (
                        <OptionGroup
                          key={type}
                          type={type}
                          entries={entries}
                          editingIdx={editingIdx}
                          setEditingIdx={setEditingIdx}
                          onRemove={removeLocalOption}
                          onUpdate={updateLocalOption}
                        />
                      );
                    })}
                  </div>
                )}

                {/* ── Customer preview ── */}
                {itemIsChopBar && itemOptions.length > 0 && (
                  <div className="border border-surface-150 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowPreview((s) => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-surface-100 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-surface-600 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Preview what customers see
                      </span>
                      <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
                    </button>
                    {showPreview && (
                      <CustomerPreview
                        options={itemOptions}
                        basePrice={parseFloat(itemPrice) || 0}
                        itemName={itemName || 'this item'}
                      />
                    )}
                  </div>
                )}
              </div>
            </form>

            <div className="border-t border-surface-100 p-6 flex gap-3">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-surface-200 text-surface-700 font-semibold hover:bg-surface-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleItemSubmit}
                disabled={itemFormLoading}
                className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {itemFormLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Item'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-type chip input ───────────────────────────────── */

function SubTypeChips({
  subs,
  setSubs,
  draft,
  setDraft,
  placeholder,
}: {
  subs: string[];
  setSubs: React.Dispatch<React.SetStateAction<string[]>>;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  placeholder: string;
}) {
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setSubs((prev) => {
      const seen = new Set(prev.map((s) => s.toLowerCase()));
      return [...prev, ...parts.filter((p) => !seen.has(p.toLowerCase()))];
    });
    setDraft('');
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-xl border border-surface-200 bg-white focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
      {subs.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-surface-100 text-surface-700 text-[11px] font-semibold px-2 py-1 rounded-lg">
          {s}
          <button
            type="button"
            onClick={() => setSubs((prev) => prev.filter((_, j) => j !== i))}
            className="text-surface-400 hover:text-error-600"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
        placeholder={subs.length ? 'Add more…' : placeholder}
        className="flex-1 min-w-[90px] text-sm bg-transparent outline-none placeholder:text-surface-400 py-0.5"
      />
    </div>
  );
}

/* ─── Editor for a single saved option (inline) ──────────── */

function RowEditor({
  type,
  option,
  onSave,
  onCancel,
}: {
  type: OptionType;
  option: MenuItemOption;
  onSave: (patch: Partial<MenuItemOption>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(option.name);
  const [price, setPrice] = useState(option.price_modifier ? String(option.price_modifier) : '');
  const [min, setMin] = useState((option.min_quantity ?? 0) ? String(option.min_quantity) : '');
  const [subs, setSubs] = useState<string[]>(parseSubs(option.sub_options));
  const [draft, setDraft] = useState('');

  const save = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    const allSubs = [...subs, ...parts.filter((p) => !subs.some((s) => s.toLowerCase() === p.toLowerCase()))];
    onSave({
      name: name.trim() || option.name,
      price_modifier: type === 'soup' ? 0 : parseFloat(price) || 0,
      min_quantity: type === 'protein' ? parseFloat(min) || 0 : 0,
      sub_options: joinSubs(allSubs),
    });
  };

  return (
    <div className="space-y-2.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      />
      {type === 'protein' && (
        <input
          type="number"
          step="0.01"
          min="0"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Minimum amount (GH₵)"
          className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      )}
      {type === 'extra' && (
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (GH₵) — 0 = free"
          className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      )}
      {type !== 'soup' && (
        <SubTypeChips subs={subs} setSubs={setSubs} draft={draft} setDraft={setDraft} placeholder="Add a type — press Enter" />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-surface-200 text-surface-600 hover:bg-surface-50 rounded-lg text-xs font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Grouped, inline-editable option list ──────────────── */

function OptionGroup({
  type,
  entries,
  editingIdx,
  setEditingIdx,
  onRemove,
  onUpdate,
}: {
  type: OptionType;
  entries: { o: MenuItemOption; i: number }[];
  editingIdx: number | null;
  setEditingIdx: (i: number | null) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<MenuItemOption>) => void;
}) {
  const meta = OPTION_TYPE_META[type];
  const plural = type === 'soup' ? 'Soups' : type === 'protein' ? 'Proteins & Meats' : 'Add-ons & Extras';
  return (
    <div className={`border rounded-xl overflow-hidden ${meta.group}`}>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
          {meta.emoji} {plural}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge}`}>
            {entries.length}
          </span>
        </span>
      </div>
      <div className="bg-white divide-y divide-surface-100">
        {entries.map(({ o, i }) =>
          editingIdx === i ? (
            <div key={i} className="p-3 bg-surface-50/60">
              <RowEditor
                type={type}
                option={o}
                onCancel={() => setEditingIdx(null)}
                onSave={(patch) => { onUpdate(i, patch); setEditingIdx(null); }}
              />
            </div>
          ) : (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 group">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-surface-800 truncate">{o.name}</span>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {o.sub_options && (
                    <span className="text-[10px] text-surface-400 font-medium">Types: {o.sub_options}</span>
                  )}
                  {(o.min_quantity ?? 0) > 0 && (
                    <span className="text-[10px] text-brand-500 font-bold">Min: {formatGHS(o.min_quantity ?? 0)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-brand-500">
                  {o.price_modifier > 0 ? `+${formatGHS(o.price_modifier)}` : 'Included'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingIdx(i)}
                  className="p-1 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
                  title="Edit option"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="p-1 text-surface-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                  title="Remove option"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ─── Read-only customer preview ────────────────────────── */

function CustomerPreview({
  options,
  basePrice,
  itemName,
}: {
  options: MenuItemOption[];
  basePrice: number;
  itemName: string;
}) {
  const soups = options.filter((o) => o.option_type === 'soup');
  const proteins = options.filter((o) => o.option_type === 'protein');
  const extras = options.filter((o) => o.option_type === 'extra');

  return (
    <div className="bg-white px-4 py-4 space-y-4 border-t border-surface-100">
      <p className="text-[11px] text-surface-400 italic">
        This is how the bowl builder appears to your customers.
      </p>

      {/* Base */}
      <div className="bg-surface-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs font-bold text-surface-600">{itemName} amount</span>
        <span className="text-[10px] font-bold text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded-md uppercase">
          Min: {formatGHS(basePrice)}
        </span>
      </div>

      {/* Soups */}
      {soups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-surface-400 uppercase tracking-wider">Select soup (free)</p>
          <div className="grid grid-cols-2 gap-2">
            {soups.map((s, i) => (
              <div key={i} className="px-3 py-2 rounded-lg border border-surface-200 text-xs font-semibold text-surface-600">
                {s.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proteins */}
      {proteins.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-surface-400 uppercase tracking-wider">Add meats & proteins</p>
          <div className="space-y-2">
            {proteins.map((p, i) => (
              <div key={i} className="rounded-xl border border-surface-150 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-surface-800">{p.name}</span>
                  {(p.min_quantity ?? 0) > 0 && (
                    <span className="text-[9px] font-bold bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded">
                      Min: {formatGHS(p.min_quantity ?? 0)}
                    </span>
                  )}
                </div>
                {p.sub_options && (
                  <div className="flex gap-1.5 flex-wrap">
                    {parseSubs(p.sub_options).map((sub, j) => (
                      <span key={j} className="px-2 py-0.5 rounded-md border border-surface-200 text-[10px] font-bold text-surface-500">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-surface-400 font-semibold">Customer enters amount (GH₵)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras */}
      {extras.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-surface-400 uppercase tracking-wider">Add-ons & extras</p>
          <div className="space-y-1.5">
            {extras.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-surface-150 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-surface-300" />
                  <span className="text-sm font-semibold text-surface-700">{e.name}</span>
                  {e.sub_options && (
                    <span className="text-[10px] text-surface-400">({parseSubs(e.sub_options).join(', ')})</span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-surface-500">
                  {e.price_modifier > 0 ? `+${formatGHS(e.price_modifier)}` : 'Free'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

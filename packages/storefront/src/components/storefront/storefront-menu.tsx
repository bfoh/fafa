'use client';

import { useState, useEffect, useRef } from 'react';
import { CartProvider, useCart } from '../../hooks/use-cart';
import { formatGHS } from '../../lib/utils/currency';
import { Plus, Minus, ShoppingBag, X, ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '../../lib/supabase/client';
import { loadLastOrder, type LastOrder } from '../../lib/utils/customer-prefs';

interface PriceTier {
  label: string;
  price: number;
}

interface MenuItemOption {
  id: string;
  name: string;
  price_modifier: number;
  option_type?: string;
  sub_options?: string | null;
  min_quantity?: number;
  price_tiers?: PriceTier[] | string | null;
}

function parseTiers(raw: unknown): PriceTier[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((t) => {
      const o = (t ?? {}) as { label?: unknown; price?: unknown };
      return { label: String(o.label ?? ''), price: Number(o.price) || 0 };
    })
    .filter((t) => t.price > 0 || t.label.trim());
}

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_chop_bar?: boolean;
  sort_order: number;
  menu_item_options: MenuItemOption[];
}

interface CategoryData {
  id: string;
  name: string;
  sort_order: number;
  menu_items: MenuItemData[];
}

interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  delivery_fee: number;
  min_order_amount: number;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  accepts_pay_online: boolean;
  accepts_pay_on_delivery: boolean;
  primary_color: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  estimated_minutes: number | null;
}

interface StorefrontMenuProps {
  categories: CategoryData[];
  tenant: TenantConfig;
  deliveryZones: DeliveryZone[];
}

export function StorefrontMenu({
  categories: initialCategories,
  tenant,
  deliveryZones,
}: StorefrontMenuProps) {
  return (
    <CartProvider tenantSlug={tenant.slug}>
      <MenuContent
        categories={initialCategories}
        tenant={tenant}
        deliveryZones={deliveryZones}
      />
    </CartProvider>
  );
}

function MenuContent({
  categories: initialCategories,
  tenant,
}: StorefrontMenuProps) {
  const { addItem, itemCount, subtotal } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeChopBarItem, setActiveChopBarItem] = useState<MenuItemData | null>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const deepLinkDone = useRef(false);
  const supabase = createBrowserClient();

  // Deep link from Fafa: /[slug]?item=<id> jumps straight to that dish —
  // scrolls to it, highlights it, and opens the customizer for chop-bar items.
  useEffect(() => {
    if (deepLinkDone.current) return;
    const itemId = new URLSearchParams(window.location.search).get('item');
    if (!itemId) return;
    const found = categories.flatMap((c) => c.menu_items).find((m) => m.id === itemId);
    if (!found) return; // menu may still be loading — try again on next render
    deepLinkDone.current = true;
    setHighlightId(itemId);
    if (found.is_chop_bar) setActiveChopBarItem(found);
    requestAnimationFrame(() => {
      document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const t = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(t);
  }, [categories]);

  // Pull this device's last order for one-tap reorder.
  useEffect(() => {
    setLastOrder(loadLastOrder(tenant.slug));
  }, [tenant.slug]);

  // Items from the last order that still exist and are available now.
  const availableIds = new Set(
    categories.flatMap((c) => c.menu_items).filter((m) => m.is_available).map((m) => m.id)
  );
  const reorderItems = (lastOrder?.items || []).filter((it) => availableIds.has(it.menuItemId));

  function handleReorder() {
    reorderItems.forEach((it) => addItem(it));
    if (reorderItems.length) setCartOpen(true);
  }

  // Real-time subscription for menu changes
  useEffect(() => {
    const channel = supabase
      .channel('menu-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `tenant_id=eq.${tenant.id}` },
        () => refreshMenu()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_item_options' },
        () => refreshMenu()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant.id]);

  async function refreshMenu() {
    try {
      const { data: cats } = await supabase
        .from('menu_categories')
        .select(`
          id, name, sort_order,
          menu_items (
            *, menu_item_options (*)
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('sort_order');

      if (cats) {
        const updated = cats
          .map((cat: any) => ({
            ...cat,
            menu_items: ((cat.menu_items as any[]) || [])
              .filter((item: any) => item.is_available)
              .sort((a: any, b: any) => a.sort_order - b.sort_order),
          }))
          .filter((cat: any) => cat.menu_items.length > 0);
        setCategories(updated);
      }
    } catch (err) {
      console.error('Real-time menu refresh failed:', err);
    }
  }

  const handleAddItem = (item: MenuItemData) => {
    if (item.is_chop_bar) {
      setActiveChopBarItem(item);
      return;
    }
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1,
      options: [],
      imageUrl: item.image_url,
    });
  };

  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Category tabs */}
      <div className="sticky top-[calc(57px+env(safe-area-inset-top))] z-20 bg-canvas/90 backdrop-blur-xl border-b border-hairline">
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar snap-rail">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="snap-start-item shrink-0 px-4 py-2 min-h-[38px] flex items-center rounded-full text-sm font-semibold press text-surface-600 bg-white border border-hairline shadow-sm hover:bg-surface-50"
            >
              {cat.name}
            </a>
          ))}
        </div>
      </div>

      {/* Order again */}
      {reorderItems.length > 0 && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-hairline bg-white p-4 shadow-card animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-surface-400 uppercase tracking-wider">Order again</p>
                <p className="text-sm font-semibold text-surface-800 truncate mt-0.5">
                  {reorderItems.map((it) => `${it.quantity}× ${it.name}`).join(', ')}
                </p>
              </div>
              <button
                onClick={handleReorder}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-white text-xs font-semibold press shadow-md"
                style={{ backgroundImage: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.primary_color}dd)` }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reorder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu items */}
      <div className="px-4 pt-4 space-y-6">
        {categories.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-32">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                className="text-[19px] font-extrabold text-surface-900 tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {cat.name}
              </h2>
              <span className="text-xs font-semibold text-surface-400 tabular-nums">
                {cat.menu_items.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {cat.menu_items.map((item) => (
                <div
                  key={item.id}
                  id={`item-${item.id}`}
                  className="group relative flex gap-3 p-2.5 bg-white rounded-2xl border border-hairline shadow-card active:scale-[0.99] transition-all duration-300 scroll-mt-28 animate-fade-in"
                  style={highlightId === item.id ? { boxShadow: `0 0 0 2px ${tenant.primary_color}, 0 10px 30px ${tenant.primary_color}33` } : undefined}
                >
                  {/* Details (left) */}
                  <div className="flex-1 min-w-0 flex flex-col py-1 pl-1.5">
                    <h3 className="font-bold text-surface-900 text-[15px] leading-snug line-clamp-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-[13px] text-surface-500 mt-1 line-clamp-2 leading-snug">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-auto pt-2.5">
                      {item.is_chop_bar ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: `${tenant.primary_color}14`, color: tenant.primary_color }}
                        >
                          🍽️ Your way{Number(item.price) > 0 ? ` · from ${formatGHS(Number(item.price))}` : ''}
                        </span>
                      ) : (
                        <p
                          className="font-extrabold text-[15px] tabular-nums"
                          style={{ color: tenant.primary_color, fontFamily: 'var(--font-display)' }}
                        >
                          {formatGHS(Number(item.price))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Photo (right) + floating add — fixed box clips any image size */}
                  <div className="relative shrink-0 self-center">
                    {item.image_url ? (
                      <div className="h-24 w-24 rounded-2xl overflow-hidden ring-1 ring-black/5 bg-surface-100">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div
                        className="h-24 w-24 rounded-2xl flex items-center justify-center text-3xl ring-1 ring-black/5"
                        style={{ background: `linear-gradient(135deg, ${tenant.primary_color}14, ${tenant.primary_color}05)` }}
                      >
                        🍽️
                      </div>
                    )}
                    <button
                      onClick={() => handleAddItem(item)}
                      aria-label={item.is_chop_bar ? `Customize ${item.name}` : `Add ${item.name}`}
                      className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-white shadow-lg ring-1 ring-black/5 grid place-items-center active:scale-90 transition-transform cursor-pointer"
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.75} style={{ color: tenant.primary_color }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Floating cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-canvas via-canvas/95 to-transparent animate-slide-up">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between px-5 h-14 rounded-2xl text-white font-semibold shadow-xl shadow-black/10 press"
              style={{ backgroundImage: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.primary_color}dd)` }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="bg-white/25 px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums">
                  {itemCount}
                </span>
              </div>
              <span>View Cart</span>
              <span className="font-bold tabular-nums">{formatGHS(subtotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          tenant={tenant}
          onClose={() => setCartOpen(false)}
        />
      )}

      {/* Chop Bar Customizer drawer */}
      {activeChopBarItem && (
        <ChopBarCustomizer
          item={activeChopBarItem}
          tenant={tenant}
          onClose={() => setActiveChopBarItem(null)}
          onAdd={(customBowl) => {
            addItem({
              menuItemId: activeChopBarItem.id,
              name: activeChopBarItem.name,
              price: customBowl.basePrice,
              quantity: 1,
              options: customBowl.options,
              imageUrl: activeChopBarItem.image_url,
            });
            setActiveChopBarItem(null);
            setCartOpen(true);
          }}
        />
      )}
    </div>
  );
}

function CartDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantConfig;
  onClose: () => void;
}) {
  const { items, updateQuantity, removeItem, subtotal, clearCart } = useCart();

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100 shrink-0">
          <h2 className="text-lg font-bold text-surface-900">Your Order</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-100 transition-colors active:scale-95 cursor-pointer"
            aria-label="Close cart"
          >
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin overscroll-contain-y">
          {items.map((item) => {
            const optionsTotal = item.options.reduce(
              (s, o) => s + o.priceModifier,
              0
            );
            const lineTotal = (item.price + optionsTotal) * item.quantity;

            return (
              <div
                key={item.menuItemId}
                className="flex items-center gap-3 animate-fade-in"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${tenant.primary_color}15` }}
                  >
                    🍽️
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 text-sm truncate">
                    {item.name}
                  </p>
                  {item.options && item.options.length > 0 && (
                    <div className="text-[10px] text-surface-400 mt-0.5 space-y-0.5 max-w-[160px]">
                      <div className="flex justify-between">
                        <span>Base price:</span>
                        <span>{formatGHS(item.price)}</span>
                      </div>
                      {item.options.map((opt, oidx) => (
                        <div key={oidx} className="flex justify-between gap-1.5 animate-fade-in">
                          <span className="truncate">• {opt.name}</span>
                          <span className="font-medium">
                            {opt.priceModifier > 0 ? `+${formatGHS(opt.priceModifier)}` : 'Free'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-semibold mt-1" style={{ color: tenant.primary_color }}>
                    {formatGHS(lineTotal)}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() =>
                      updateQuantity(item.menuItemId, item.quantity - 1)
                    }
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-100 hover:bg-surface-200 active:scale-95 transition-all cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 text-surface-600" />
                  </button>
                  <span className="w-8 text-center text-sm font-extrabold text-surface-900">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.menuItemId, item.quantity + 1)
                    }
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-white active:scale-95 transition-all cursor-pointer"
                    style={{ background: tenant.primary_color }}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-100 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-surface-500 text-sm">Subtotal</span>
            <span className="font-bold text-surface-900">
              {formatGHS(subtotal)}
            </span>
          </div>

          {tenant.min_order_amount > 0 && subtotal < tenant.min_order_amount && (
            <p className="text-xs text-warning-600 bg-warning-500/10 rounded-xl px-3 py-2">
              Minimum order: {formatGHS(tenant.min_order_amount)}. Add{' '}
              {formatGHS(tenant.min_order_amount - subtotal)} more.
            </p>
          )}

          <Link
            href={`/${tenant.slug}/checkout`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-semibold transition-all active:scale-[0.98] hover:opacity-95"
            style={{ background: tenant.primary_color }}
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={() => {
              clearCart();
              onClose();
            }}
            className="w-full text-center text-sm text-surface-400 hover:text-error-500 transition-colors"
          >
            Clear cart
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Chop Bar Customizer — uses option_type for classification
   ═══════════════════════════════════════════════════════════ */

function ChopBarCustomizer({
  item,
  tenant,
  onClose,
  onAdd,
}: {
  item: MenuItemData;
  tenant: TenantConfig;
  onClose: () => void;
  onAdd: (bowl: { basePrice: number; options: Array<{ name: string; priceModifier: number; price_modifier: number }> }) => void;
}) {
  const minBasePrice = Number(item.price) || 0;
  const [basePrice, setBasePrice] = useState<number>(Math.max(20, minBasePrice));
  const [optionsState, setOptionsState] = useState<Record<string, { checked: boolean; amount: number }>>({});
  const [selectedSubOptions, setSelectedSubOptions] = useState<Record<string, string>>({});
  const [selectedTiers, setSelectedTiers] = useState<Record<string, number>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const options = (item.menu_item_options || []).map(opt => ({
    ...opt,
    price_modifier: Number(opt.price_modifier),
    option_type: opt.option_type || 'extra',
    sub_options: opt.sub_options || null,
    min_quantity: Number(opt.min_quantity) || 0,
    price_tiers: parseTiers(opt.price_tiers),
  }));

  // Classify options by option_type (no more heuristic guessing!)
  const soups = options.filter(opt => opt.option_type === 'soup');
  const proteins = options.filter(opt => opt.option_type === 'protein');
  const extras = options.filter(opt => opt.option_type === 'extra');

  useEffect(() => {
    const initial: Record<string, { checked: boolean; amount: number }> = {};
    const subOptsInit: Record<string, string> = {};
    const tiersInit: Record<string, number> = {};

    options.forEach((opt) => {
      const defaultAmount = opt.option_type === 'soup'
        ? 0
        : (opt.price_modifier > 0 ? opt.price_modifier : Math.max(opt.min_quantity, 50));

      initial[opt.id] = {
        checked: false,
        amount: defaultAmount,
      };

      if (opt.price_tiers.length > 0) {
        tiersInit[opt.id] = 0;
      }

      if (opt.sub_options) {
        const splits = opt.sub_options.split(',').map(s => s.trim()).filter(Boolean);
        if (splits.length > 0) {
          subOptsInit[opt.id] = splits[0];
        }
      }
    });
    setOptionsState(initial);
    setSelectedSubOptions(subOptsInit);
    setSelectedTiers(tiersInit);
  }, [item]);

  const isBasePriceInvalid = basePrice < minBasePrice;

  const totalBowlPrice = basePrice + Object.keys(optionsState).reduce((sum, optId) => {
    const opt = options.find(o => o.id === optId);
    const state = optionsState[optId];
    if (!opt || !state || !state.checked) return sum;

    if (opt.price_tiers.length > 0) {
      const tier = opt.price_tiers[selectedTiers[optId] ?? 0];
      return sum + (tier ? tier.price : 0);
    }
    if (opt.price_modifier > 0) {
      return sum + Number(opt.price_modifier);
    }
    return sum + state.amount;
  }, 0);

  const handleBasePriceChange = (val: string) => {
    const parsed = parseFloat(val);
    setBasePrice(isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleToggleOption = (optId: string) => {
    setOptionsState((prev) => ({
      ...prev,
      [optId]: {
        ...prev[optId],
        checked: !prev[optId]?.checked,
      },
    }));
    // Clear validation error when unchecking
    if (optionsState[optId]?.checked) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[optId];
        return next;
      });
    }
  };

  const handleAmountChange = (optId: string, val: string) => {
    const parsed = parseFloat(val);
    const amount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setOptionsState((prev) => ({
      ...prev,
      [optId]: {
        ...prev[optId],
        amount,
      },
    }));

    // Validate minimum quantity
    const opt = options.find(o => o.id === optId);
    if (opt && opt.min_quantity > 0 && amount < opt.min_quantity && amount > 0) {
      setValidationErrors((prev) => ({
        ...prev,
        [optId]: `Minimum amount is ${formatGHS(opt.min_quantity)}`,
      }));
    } else {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[optId];
        return next;
      });
    }
  };

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const handleSubmit = () => {
    // Final validation check (amount-entry proteins only — tiers are always valid)
    const errors: Record<string, string> = {};
    options.forEach((opt) => {
      const state = optionsState[opt.id];
      if (state?.checked && opt.price_tiers.length === 0 && opt.min_quantity > 0 && opt.price_modifier === 0) {
        if (state.amount < opt.min_quantity) {
          errors[opt.id] = `Minimum amount is ${formatGHS(opt.min_quantity)}`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const selectedOptions: Array<{ name: string; priceModifier: number; price_modifier: number }> = [];

    options.forEach((opt) => {
      const state = optionsState[opt.id];
      if (state && state.checked) {
        let finalAmount: number;
        let optionName = opt.name;

        if (opt.price_tiers.length > 0) {
          const tier = opt.price_tiers[selectedTiers[opt.id] ?? 0];
          finalAmount = tier ? tier.price : 0;
          if (tier?.label) optionName = `${opt.name} (${tier.label})`;
        } else {
          finalAmount = opt.price_modifier > 0 ? Number(opt.price_modifier) : state.amount;
          if (opt.sub_options && selectedSubOptions[opt.id]) {
            optionName = `${opt.name} (${selectedSubOptions[opt.id]})`;
          }
        }

        selectedOptions.push({
          name: optionName,
          priceModifier: finalAmount,
          price_modifier: finalAmount,
        });
      }
    });

    onAdd({
      basePrice: basePrice,
      options: selectedOptions,
    });
  };

  const baseSuggestions = [10, 20, 30, 40, 50].filter(val => val >= minBasePrice);
  if (minBasePrice > 0 && !baseSuggestions.includes(minBasePrice)) {
    baseSuggestions.unshift(minBasePrice);
    baseSuggestions.sort((a, b) => a - b);
  }

  const proteinSuggestions = [20, 30, 50, 100];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-surface-900">Configure Your Bowl</h2>
            <p className="text-[11px] text-surface-400 mt-0.5">Customize your {item.name} precisely</p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-100 transition-colors active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin overscroll-contain-y">
          {/* Section 1: Base quantity */}
          <div className="space-y-2 bg-surface-50 p-3 rounded-2xl border border-surface-100">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                {item.name} Amount (GH₵)
              </label>
              {minBasePrice > 0 && (
                <span className="text-[10px] font-bold text-brand-500 uppercase bg-brand-500/10 px-2 py-0.5 rounded-md">
                  Min: {formatGHS(minBasePrice)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={minBasePrice}
                step="1"
                required
                value={basePrice === 0 ? '' : basePrice}
                onChange={(e) => handleBasePriceChange(e.target.value)}
                className={`w-28 px-4 py-2 rounded-xl border bg-white text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${
                  isBasePriceInvalid ? 'border-error-500 ring-2 ring-error-500/20' : 'border-surface-200'
                }`}
                style={{ '--tw-ring-color': tenant.primary_color } as React.CSSProperties}
              />
              <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                {baseSuggestions.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBasePrice(val)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                      basePrice === val
                        ? 'text-white border-transparent'
                        : 'bg-white border-surface-200 text-surface-700 hover:bg-surface-100'
                    }`}
                    style={basePrice === val ? { background: tenant.primary_color } : {}}
                  >
                    GH₵ {val}
                  </button>
                ))}
              </div>
            </div>
            {isBasePriceInvalid && (
              <p className="text-[10px] font-extrabold text-error-600 mt-1.5 animate-fade-in uppercase tracking-wider">
                ⚠️ Minimum amount required for this item is {formatGHS(minBasePrice)}
              </p>
            )}
          </div>

          {/* Section 2: Soups (using option_type) */}
          {soups.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                Select Soup (Free / Included)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {soups.map((soup) => {
                  const isChecked = optionsState[soup.id]?.checked ?? false;
                  return (
                    <button
                      key={soup.id}
                      type="button"
                      onClick={() => handleToggleOption(soup.id)}
                      className={`p-3 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-success-50/40 border-success-500 text-success-800'
                          : 'border-surface-200 hover:bg-surface-50 text-surface-700'
                      }`}
                    >
                      <span className="truncate">{soup.name}</span>
                      {isChecked && <span className="text-success-600 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Proteins/Custom Meats (using option_type) */}
          {proteins.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                Add Meats & Proteins
              </h3>
              <div className="space-y-2.5">
                {proteins.map((meat) => {
                  const state = optionsState[meat.id];
                  const isChecked = state?.checked ?? false;
                  const currentAmt = state?.amount ?? 50;
                  const minQty = meat.min_quantity || 0;
                  const error = validationErrors[meat.id];
                  const hasTiers = meat.price_tiers.length > 0;
                  const tierIdx = selectedTiers[meat.id] ?? 0;
                  const tierPrice = hasTiers ? (meat.price_tiers[tierIdx]?.price ?? 0) : 0;

                  return (
                    <div
                      key={meat.id}
                      className={`p-3 rounded-2xl border transition-all space-y-3 ${
                        isChecked
                          ? 'border-brand-500/20 bg-brand-500/[0.01]'
                          : 'border-surface-150 bg-white'
                      }`}
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => handleToggleOption(meat.id)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4.5 h-4.5 rounded text-brand-500 border-surface-300"
                            style={{ accentColor: tenant.primary_color }}
                          />
                          <span className="text-sm font-semibold text-surface-800">
                            {meat.name}
                          </span>
                          {!hasTiers && minQty > 0 && (
                            <span className="text-[9px] font-bold bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded">
                              Min: {formatGHS(minQty)}
                            </span>
                          )}
                        </div>
                        {isChecked && (
                          <span
                            className="text-xs font-bold"
                            style={{ color: tenant.primary_color }}
                          >
                            {formatGHS(hasTiers ? tierPrice : currentAmt)}
                          </span>
                        )}
                      </div>

                      {isChecked && (
                        <div className="pl-6 animate-fade-in space-y-3">
                          {hasTiers ? (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider block">Choose option:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {meat.price_tiers.map((t, ti) => {
                                  const sel = tierIdx === ti;
                                  return (
                                    <button
                                      key={ti}
                                      type="button"
                                      onClick={() => setSelectedTiers(prev => ({ ...prev, [meat.id]: ti }))}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                        sel
                                          ? 'text-white border-transparent shadow-sm'
                                          : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                      }`}
                                      style={sel ? { background: tenant.primary_color } : {}}
                                    >
                                      {t.label ? `${t.label} · ` : ''}{formatGHS(t.price)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <>
                              {meat.sub_options && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider block">Select Type:</span>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {meat.sub_options.split(',').map(s => s.trim()).filter(Boolean).map((sub) => {
                                      const isSubSelected = selectedSubOptions[meat.id] === sub;
                                      return (
                                        <button
                                          key={sub}
                                          type="button"
                                          onClick={() => setSelectedSubOptions(prev => ({ ...prev, [meat.id]: sub }))}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                            isSubSelected
                                              ? 'text-white border-transparent shadow-sm'
                                              : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                          }`}
                                          style={isSubSelected ? { background: tenant.primary_color } : {}}
                                        >
                                          {sub}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-surface-400 font-semibold">Amount:</span>
                                <input
                                  type="number"
                                  min={minQty}
                                  step="1"
                                  value={currentAmt === 0 ? '' : currentAmt}
                                  onChange={(e) => handleAmountChange(meat.id, e.target.value)}
                                  className={`w-24 px-3 py-1.5 rounded-lg border bg-white text-surface-900 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/40 ${
                                    error ? 'border-error-500 ring-1 ring-error-500/20' : 'border-surface-200'
                                  }`}
                                  style={{ '--tw-ring-color': tenant.primary_color } as React.CSSProperties}
                                />
                                <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                                  {proteinSuggestions.filter(v => v >= minQty).map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => handleAmountChange(meat.id, val.toString())}
                                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors shrink-0 ${
                                        currentAmt === val
                                          ? 'text-white border-transparent shadow-sm'
                                          : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                      }`}
                                      style={currentAmt === val ? { background: tenant.primary_color } : {}}
                                    >
                                      GH₵ {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {error && (
                                <p className="text-[10px] font-bold text-error-600 animate-fade-in">
                                  ⚠️ {error}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Fixed Price Extras (using option_type) */}
          {extras.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                Add-ons & Extras
              </h3>
              <div className="space-y-2.5">
                {extras.map((extra) => {
                  const isChecked = optionsState[extra.id]?.checked ?? false;
                  return (
                    <div
                      key={extra.id}
                      className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                        isChecked
                          ? 'border-brand-500/20 bg-brand-500/[0.01]'
                          : 'border-surface-150 bg-white'
                      }`}
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => handleToggleOption(extra.id)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4.5 h-4.5 rounded text-brand-500 border-surface-300"
                            style={{ accentColor: tenant.primary_color }}
                          />
                          <div>
                            <span className="text-sm font-semibold text-surface-800 block leading-tight">
                              {extra.name}
                            </span>
                            <span className="text-[10px] text-surface-400 font-semibold mt-0.5 block">
                              +{formatGHS(Number(extra.price_modifier))}
                            </span>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-success-600 text-xs">✓</span>
                        )}
                      </div>

                      {isChecked && extra.sub_options && (
                        <div className="pl-6.5 animate-fade-in space-y-1.5">
                          <span className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider block">Select Type:</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {extra.sub_options.split(',').map(s => s.trim()).filter(Boolean).map((sub) => {
                              const isSubSelected = selectedSubOptions[extra.id] === sub;
                              return (
                                <button
                                  key={sub}
                                  type="button"
                                  onClick={() => setSelectedSubOptions(prev => ({ ...prev, [extra.id]: sub }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    isSubSelected
                                      ? 'text-white border-transparent shadow-sm'
                                      : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                  }`}
                                  style={isSubSelected ? { background: tenant.primary_color } : {}}
                                >
                                  {sub}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Total and Submit */}
        <div className="border-t border-surface-100 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 bg-surface-50/50 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-surface-500">Bowl Total:</span>
            <span className="text-lg font-black text-surface-950">{formatGHS(totalBowlPrice)}</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isBasePriceInvalid || totalBowlPrice <= 0 || hasValidationErrors}
            className="w-full py-4 min-h-[56px] rounded-2xl text-white font-bold transition-all active:scale-[0.98] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/5"
            style={{ background: tenant.primary_color }}
          >
            Add Bowl to Order — {formatGHS(totalBowlPrice)}
          </button>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { CartProvider, useCart } from '@/hooks/use-cart';
import { formatGHS } from '@/lib/utils/currency';
import { Plus, Minus, ShoppingBag, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface MenuItemOption {
  id: string;
  name: string;
  price_modifier: number;
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
  categories,
  tenant,
  deliveryZones,
}: StorefrontMenuProps) {
  return (
    <CartProvider tenantSlug={tenant.slug}>
      <MenuContent
        categories={categories}
        tenant={tenant}
        deliveryZones={deliveryZones}
      />
    </CartProvider>
  );
}

function MenuContent({
  categories,
  tenant,
}: StorefrontMenuProps) {
  const { addItem, itemCount, subtotal } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeChopBarItem, setActiveChopBarItem] = useState<MenuItemData | null>(null);

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
    <div className="pb-24">
      {/* Category tabs */}
      <div className="sticky top-[57px] z-20 bg-surface-50 border-b border-surface-100">
        <div className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-thin">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="shrink-0 px-5 py-2.5 rounded-full text-xs font-extrabold transition-colors hover:bg-surface-200 text-surface-600 bg-surface-100 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]"
            >
              {cat.name}
            </a>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="px-4 pt-4 space-y-6">
        {categories.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">
              {cat.name}
            </h2>
            <div className="space-y-3">
              {cat.menu_items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 bg-white rounded-2xl border border-surface-100 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
                >
                  {/* Image */}
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
                      style={{
                        background: `${tenant.primary_color}15`,
                      }}
                    >
                      🍽️
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-surface-900 text-sm">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p
                        className="font-bold text-sm"
                        style={{ color: tenant.primary_color }}
                      >
                        {formatGHS(Number(item.price))}
                      </p>
                      <button
                        onClick={() => handleAddItem(item)}
                        className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-white text-xs font-semibold transition-all active:scale-95 hover:opacity-90 shadow-md min-h-[40px] cursor-pointer"
                        style={{ background: tenant.primary_color }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Floating cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white font-semibold shadow-xl transition-all active:scale-[0.98] hover:opacity-95"
              style={{ background: tenant.primary_color }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">
                  {itemCount}
                </span>
              </div>
              <span>View Cart</span>
              <span className="font-bold">{formatGHS(subtotal)}</span>
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
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100">
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
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
        <div className="border-t border-surface-100 px-5 py-4 space-y-3">
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
  const [basePrice, setBasePrice] = useState<number>(20);
  const [optionsState, setOptionsState] = useState<Record<string, { checked: boolean; amount: number }>>({});

  useEffect(() => {
    const initial: Record<string, { checked: boolean; amount: number }> = {};
    const opts = (item.menu_item_options || []).map(opt => ({
      ...opt,
      price_modifier: Number(opt.price_modifier),
    }));
    opts.forEach((opt) => {
      const isSoup = opt.price_modifier === 0 && (
        opt.name.toLowerCase().includes('soup') ||
        opt.name.toLowerCase().includes('abunabunu') ||
        opt.name.toLowerCase().includes('abekwan') ||
        opt.name.toLowerCase().includes('wrewre')
      );
      
      initial[opt.id] = {
        checked: false,
        amount: isSoup ? 0 : (opt.price_modifier > 0 ? opt.price_modifier : 50),
      };
    });
    setOptionsState(initial);
  }, [item]);

  const options = (item.menu_item_options || []).map(opt => ({
    ...opt,
    price_modifier: Number(opt.price_modifier),
  }));

  const soups = options.filter(opt => 
    opt.price_modifier === 0 && (
      opt.name.toLowerCase().includes('soup') ||
      opt.name.toLowerCase().includes('abunabunu') ||
      opt.name.toLowerCase().includes('abekwan') ||
      opt.name.toLowerCase().includes('wrewre')
    )
  );

  const fixedExtras = options.filter(opt => 
    opt.price_modifier > 0
  );

  const customProteins = options.filter(opt => 
    opt.price_modifier === 0 && !soups.find(s => s.id === opt.id)
  );

  const totalBowlPrice = basePrice + Object.keys(optionsState).reduce((sum, optId) => {
    const opt = options.find(o => o.id === optId);
    const state = optionsState[optId];
    if (!opt || !state || !state.checked) return sum;
    
    if (opt.price_modifier > 0) {
      return sum + Number(opt.price_modifier);
    } else {
      return sum + state.amount;
    }
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
  };

  const handleAmountChange = (optId: string, val: string) => {
    const parsed = parseFloat(val);
    setOptionsState((prev) => ({
      ...prev,
      [optId]: {
        ...prev[optId],
        amount: isNaN(parsed) || parsed < 0 ? 0 : parsed,
      },
    }));
  };

  const handleSubmit = () => {
    const selectedOptions: Array<{ name: string; priceModifier: number; price_modifier: number }> = [];
    
    options.forEach((opt) => {
      const state = optionsState[opt.id];
      if (state && state.checked) {
        const finalAmount = opt.price_modifier > 0 ? Number(opt.price_modifier) : state.amount;
        selectedOptions.push({
          name: opt.name,
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

  const baseSuggestions = [10, 20, 30, 40, 50];
  const proteinSuggestions = [20, 30, 50, 100];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100">
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
          {/* Section 1: Base quantity */}
          <div className="space-y-2 bg-surface-50 p-3 rounded-2xl border border-surface-100">
            <label className="block text-xs font-extrabold text-surface-500 uppercase tracking-wider">
              {item.name} Amount (GH₵)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="1"
                required
                value={basePrice === 0 ? '' : basePrice}
                onChange={(e) => handleBasePriceChange(e.target.value)}
                className="w-28 px-4 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
          </div>

          {/* Section 2: Soups */}
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

          {/* Section 3: Proteins/Custom Meats */}
          {customProteins.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                Add Meats & Proteins
              </h3>
              <div className="space-y-2.5">
                {customProteins.map((meat) => {
                  const state = optionsState[meat.id];
                  const isChecked = state?.checked ?? false;
                  const currentAmt = state?.amount ?? 50;

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
                        </div>
                        {isChecked && (
                          <span
                            className="text-xs font-bold"
                            style={{ color: tenant.primary_color }}
                          >
                            GH₵ {currentAmt}
                          </span>
                        )}
                      </div>

                      {isChecked && (
                        <div className="pl-6 animate-fade-in space-y-2">
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-surface-400 font-semibold">Amount:</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={currentAmt === 0 ? '' : currentAmt}
                              onChange={(e) => handleAmountChange(meat.id, e.target.value)}
                              className="w-24 px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-surface-900 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                              style={{ '--tw-ring-color': tenant.primary_color } as React.CSSProperties}
                            />
                            <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                              {proteinSuggestions.map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleAmountChange(meat.id, val.toString())}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors shrink-0 ${
                                    currentAmt === val
                                      ? 'text-white border-transparent'
                                      : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                  }`}
                                  style={currentAmt === val ? { background: tenant.primary_color } : {}}
                                >
                                  GH₵ {val}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Fixed Price Extras */}
          {fixedExtras.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-surface-500 uppercase tracking-wider">
                Add-ons & Extras
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {fixedExtras.map((extra) => {
                  const isChecked = optionsState[extra.id]?.checked ?? false;
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => handleToggleOption(extra.id)}
                      className={`p-3 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-brand-500/[0.02] border-brand-500 text-surface-900'
                          : 'border-surface-200 hover:bg-surface-50 text-surface-600'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <p className="font-semibold">{extra.name}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">+{formatGHS(Number(extra.price_modifier))}</p>
                      </div>
                      {isChecked && <span className="text-xs font-bold shrink-0" style={{ color: tenant.primary_color }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Total and Submit */}
        <div className="border-t border-surface-100 p-5 space-y-3 bg-surface-50/50">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-surface-500">Bowl Total:</span>
            <span className="text-lg font-black text-surface-950">{formatGHS(totalBowlPrice)}</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={totalBowlPrice <= 0}
            className="w-full py-3.5 rounded-2xl text-white font-bold transition-all active:scale-[0.98] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/5"
            style={{ background: tenant.primary_color }}
          >
            Add Bowl to Order — {formatGHS(totalBowlPrice)}
          </button>
        </div>
      </div>
    </>
  );
}

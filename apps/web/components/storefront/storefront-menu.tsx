'use client';

import { useState } from 'react';
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

  const handleAddItem = (item: MenuItemData) => {
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
                  <p className="text-sm" style={{ color: tenant.primary_color }}>
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

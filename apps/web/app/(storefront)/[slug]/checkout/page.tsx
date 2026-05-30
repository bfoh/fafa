'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/hooks/use-cart';
import { formatGHS } from '@/lib/utils/currency';
import { useParams, useRouter } from 'next/navigation';
import { CartProvider } from '@/hooks/use-cart';
import { ArrowLeft, CreditCard, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <CartProvider tenantSlug={slug}>
      <CheckoutContent slug={slug} />
    </CartProvider>
  );
}

function CheckoutContent({ slug }: { slug: string }) {
  const { items, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card' | 'cash_on_delivery'>('momo');

  // Tenant config state
  const [tenant, setTenant] = useState<{
    id: string;
    name: string;
    delivery_fee: number;
    min_order_amount: number;
    accepts_delivery: boolean;
    accepts_pickup: boolean;
    accepts_pay_online: boolean;
    accepts_pay_on_delivery: boolean;
    primary_color: string;
  } | null>(null);

  // Delivery zones state
  const [deliveryZones, setDeliveryZones] = useState<Array<{
    id: string;
    name: string;
    fee: number;
    estimated_minutes: number | null;
  }>>([]);

  const supabase = useMemo(() => createBrowserClient(), []);

  // Fetch tenant info & active delivery zones
  useEffect(() => {
    async function loadTenantData() {
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('id, name, slug, delivery_fee, min_order_amount, accepts_delivery, accepts_pickup, accepts_pay_online, accepts_pay_on_delivery, primary_color')
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (tenantData) {
          const loadedTenant = {
            id: tenantData.id,
            name: tenantData.name,
            delivery_fee: Number(tenantData.delivery_fee),
            min_order_amount: Number(tenantData.min_order_amount),
            accepts_delivery: tenantData.accepts_delivery,
            accepts_pickup: tenantData.accepts_pickup,
            accepts_pay_online: tenantData.accepts_pay_online,
            accepts_pay_on_delivery: tenantData.accepts_pay_on_delivery,
            primary_color: tenantData.primary_color || '#FF6B35',
          };
          setTenant(loadedTenant);

          // Handle default delivery type selection based on tenant preferences
          if (loadedTenant.accepts_delivery && !loadedTenant.accepts_pickup) {
            setDeliveryType('delivery');
          } else if (!loadedTenant.accepts_delivery && loadedTenant.accepts_pickup) {
            setDeliveryType('pickup');
          }

          // Handle default payment method selection based on tenant preferences
          const available: Array<'momo' | 'card' | 'cash_on_delivery'> = [];
          if (loadedTenant.accepts_pay_online) {
            available.push('momo', 'card');
          }
          if (loadedTenant.accepts_pay_on_delivery) {
            available.push('cash_on_delivery');
          }
          if (available.length > 0) {
            setPaymentMethod(available[0]);
          }

          const { data: zones } = await supabase
            .from('delivery_zones')
            .select('id, name, fee, estimated_minutes')
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
            .order('name');

          if (zones) {
            setDeliveryZones(
              zones.map((z) => ({
                id: z.id,
                name: z.name,
                fee: Number(z.fee),
                estimated_minutes: z.estimated_minutes,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to load tenant checkout config:', err);
      }
    }
    loadTenantData();
  }, [supabase, slug]);

  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId);
  const deliveryFee =
    deliveryType === 'delivery'
      ? selectedZone
        ? selectedZone.fee
        : tenant
        ? tenant.delivery_fee
        : 0
      : 0;

  const total = subtotal + deliveryFee;
  const primaryColor = tenant?.primary_color || '#FF6B35';

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <p className="text-surface-500">Your cart is empty</p>
        <Link
          href={`/${slug}`}
          className="inline-block mt-4 text-sm font-semibold hover:underline"
          style={{ color: primaryColor }}
        >
          ← Back to menu
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slug,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            options: item.options,
          })),
          customer: { name, phone, email: email || undefined },
          deliveryType,
          deliveryAddress: deliveryType === 'delivery' ? address : undefined,
          deliveryNotes: notes || undefined,
          paymentMethod,
          deliveryZoneId: deliveryType === 'delivery' && selectedZoneId ? selectedZoneId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to place order');
        setLoading(false);
        return;
      }

      // Clear cart
      clearCart();

      // If online payment, redirect to Paystack
      if (data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }

      // Cash on delivery → order confirmation
      router.push(`/${slug}/order/${data.order.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const paymentMethods = [
    {
      value: 'momo' as const,
      label: 'Mobile Money',
      desc: 'MTN, Vodafone, AirtelTigo',
      icon: Smartphone,
      available: tenant ? tenant.accepts_pay_online : true,
    },
    {
      value: 'card' as const,
      label: 'Card',
      desc: 'Visa, Mastercard',
      icon: CreditCard,
      available: tenant ? tenant.accepts_pay_online : true,
    },
    {
      value: 'cash_on_delivery' as const,
      label: 'Pay on Delivery',
      desc: 'Cash when your order arrives',
      icon: Banknote,
      available: tenant ? tenant.accepts_pay_on_delivery : true,
    },
  ].filter((m) => m.available);

  const belowMinLimit = tenant ? subtotal < tenant.min_order_amount : false;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-fade-in">
      <Link
        href={`/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to menu
      </Link>

      <h1 className="text-xl font-bold text-surface-900 mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Customer details */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
            Your Details
          </h2>

          <div>
            <label htmlFor="checkout-name" className="block text-sm font-medium text-surface-700 mb-1">
              Name
            </label>
            <input
              id="checkout-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm"
              style={{
                ['--tw-ring-color' as string]: primaryColor,
              } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="checkout-phone" className="block text-sm font-medium text-surface-700 mb-1">
              Phone number
            </label>
            <input
              id="checkout-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="024 123 4567"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm"
              style={{
                ['--tw-ring-color' as string]: primaryColor,
              } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="checkout-email" className="block text-sm font-medium text-surface-700 mb-1">
              Email <span className="text-surface-400">(optional)</span>
            </label>
            <input
              id="checkout-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm"
              style={{
                ['--tw-ring-color' as string]: primaryColor,
              } as React.CSSProperties}
            />
          </div>
        </section>

        {/* Delivery type */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
            Delivery Option
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {(!tenant || tenant.accepts_delivery) && (
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className="p-3 rounded-xl border-2 text-center text-sm font-medium transition-all cursor-pointer"
                style={{
                  borderColor: deliveryType === 'delivery' ? primaryColor : 'var(--surface-200)',
                  backgroundColor: deliveryType === 'delivery' ? `${primaryColor}10` : 'transparent',
                }}
              >
                🚗 Delivery
              </button>
            )}
            {(!tenant || tenant.accepts_pickup) && (
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className="p-3 rounded-xl border-2 text-center text-sm font-medium transition-all cursor-pointer"
                style={{
                  borderColor: deliveryType === 'pickup' ? primaryColor : 'var(--surface-200)',
                  backgroundColor: deliveryType === 'pickup' ? `${primaryColor}10` : 'transparent',
                }}
              >
                🏪 Pickup
              </button>
            )}
          </div>

          {deliveryType === 'delivery' && (
            <div className="animate-fade-in space-y-3">
              {deliveryZones.length > 0 && (
                <div>
                  <label htmlFor="checkout-zone" className="block text-sm font-medium text-surface-700 mb-1">
                    Select Your Area
                  </label>
                  <select
                    id="checkout-zone"
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all text-sm cursor-pointer"
                    style={{
                      ['--tw-ring-color' as string]: primaryColor,
                    } as React.CSSProperties}
                  >
                    <option value="">Select neighborhood...</option>
                    {deliveryZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} ({formatGHS(zone.fee)} · {zone.estimated_minutes || 30} mins)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="checkout-address" className="block text-sm font-medium text-surface-700 mb-1">
                  Delivery address
                </label>
                <textarea
                  id="checkout-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="House number, street, landmark, area details..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm resize-none"
                  style={{
                    ['--tw-ring-color' as string]: primaryColor,
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label htmlFor="checkout-notes" className="block text-sm font-medium text-surface-700 mb-1">
                  Notes <span className="text-surface-400">(optional)</span>
                </label>
                <input
                  id="checkout-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Call when you arrive, gate code is 1234"
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm"
                  style={{
                    ['--tw-ring-color' as string]: primaryColor,
                  } as React.CSSProperties}
                />
              </div>
            </div>
          )}
        </section>

        {/* Payment method */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
            Payment Method
          </h2>

          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer"
                  style={{
                    borderColor: isSelected ? primaryColor : 'var(--surface-200)',
                    backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                  }}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    style={{
                      color: isSelected ? primaryColor : undefined,
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-surface-900">
                      {method.label}
                    </p>
                    <p className="text-xs text-surface-400">{method.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Order summary */}
        <section className="bg-surface-100 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-surface-600">
            <span>Subtotal</span>
            <span>{formatGHS(subtotal)}</span>
          </div>
          {deliveryType === 'delivery' && (
            <div className="flex justify-between text-sm text-surface-600">
              <span>Delivery fee {selectedZone ? `(${selectedZone.name})` : ''}</span>
              <span>{formatGHS(deliveryFee)}</span>
            </div>
          )}
          <div className="border-t border-surface-200 pt-2 flex justify-between font-bold text-surface-900">
            <span>Total</span>
            <span>{formatGHS(total)}</span>
          </div>
        </section>

        {/* Limit warning */}
        {belowMinLimit && tenant && (
          <div className="p-3 rounded-xl bg-warning-500/10 text-warning-700 text-xs text-center font-medium animate-fade-in">
            ⚠️ Minimum order amount of {formatGHS(tenant.min_order_amount)} is required by this restaurant. Please add more items to checkout.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || belowMinLimit}
          className="w-full py-4 min-h-[56px] rounded-2xl text-white font-bold transition-all active:scale-[0.98] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/5"
          style={{ background: primaryColor }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Placing order...
            </>
          ) : paymentMethod === 'cash_on_delivery' ? (
            `Place Order — ${formatGHS(total)}`
          ) : (
            `Pay ${formatGHS(total)}`
          )}
        </button>
      </form>
    </div>
  );
}

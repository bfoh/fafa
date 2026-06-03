'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/hooks/use-cart';
import { saveCustomer, loadCustomer, saveLastOrder } from '@/lib/utils/customer-prefs';
import { formatGHS } from '@/lib/utils/currency';
import { useParams, useRouter } from 'next/navigation';
import { CartProvider } from '@/hooks/use-cart';
import { ArrowLeft, CreditCard, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import { GHANA_CITIES } from '@/lib/delivery/ghana-areas';
import { resolveDeliveryFee } from '@/lib/delivery/resolve';
import { estimateMinutes, DEFAULT_PREP_MINUTES } from '@/lib/delivery/pricing';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/onboarding/location-picker'), {
  ssr: false,
});

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
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [customerPin, setCustomerPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card' | 'cash_on_delivery'>('momo');

  // Prefill from this device's saved details (returning customer).
  useEffect(() => {
    const saved = loadCustomer();
    if (saved) {
      setName((v) => v || saved.name || '');
      setPhone((v) => v || saved.phone || '');
      setAddress((v) => v || saved.address || '');
    }
  }, []);

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
    location_lat: number | null;
    location_lng: number | null;
    city: string | null;
    free_delivery_radius_km: number | null;
    per_km_rate: number | null;
    max_delivery_distance_km: number | null;
    avg_prep_minutes: number | null;
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
          .select('id, name, slug, delivery_fee, min_order_amount, accepts_delivery, accepts_pickup, accepts_pay_online, accepts_pay_on_delivery, primary_color, location_lat, location_lng, city, free_delivery_radius_km, per_km_rate, max_delivery_distance_km, avg_prep_minutes')
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
            location_lat: tenantData.location_lat != null ? Number(tenantData.location_lat) : null,
            location_lng: tenantData.location_lng != null ? Number(tenantData.location_lng) : null,
            city: tenantData.city ?? null,
            free_delivery_radius_km: tenantData.free_delivery_radius_km != null ? Number(tenantData.free_delivery_radius_km) : null,
            per_km_rate: tenantData.per_km_rate != null ? Number(tenantData.per_km_rate) : null,
            max_delivery_distance_km: tenantData.max_delivery_distance_km != null ? Number(tenantData.max_delivery_distance_km) : null,
            avg_prep_minutes: tenantData.avg_prep_minutes != null ? Number(tenantData.avg_prep_minutes) : null,
          };
          setTenant(loadedTenant);

          // Default the city selector to the restaurant's city if we know it.
          if (loadedTenant.city && GHANA_CITIES.some((c) => c.name === loadedTenant.city)) {
            setSelectedCity(loadedTenant.city);
          }

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

  const activeZones = useMemo(
    () => deliveryZones.map((z) => ({ name: z.name, fee: z.fee })),
    [deliveryZones]
  );

  const feeResult = useMemo(() => {
    if (deliveryType !== 'delivery' || !tenant || !selectedArea) return null;
    return resolveDeliveryFee({
      restaurant: {
        lat: tenant.location_lat,
        lng: tenant.location_lng,
        baseFee: tenant.delivery_fee,
        freeRadiusKm: tenant.free_delivery_radius_km,
        perKmRate: tenant.per_km_rate,
        maxDistanceKm: tenant.max_delivery_distance_km,
      },
      city: selectedCity,
      areaName: selectedArea,
      manualZones: activeZones,
      customer: customerPin,
    });
  }, [deliveryType, tenant, selectedCity, selectedArea, activeZones, customerPin]);

  const deliveryFee = deliveryType === 'delivery' ? feeResult?.fee ?? 0 : 0;
  const notDeliverable = feeResult ? !feeResult.deliverable : false;
  const etaMinutes =
    feeResult && tenant
      ? estimateMinutes({
          distanceKm: feeResult.distanceKm,
          prepMinutes: tenant.avg_prep_minutes ?? DEFAULT_PREP_MINUTES,
        })
      : null;
  const total = subtotal + deliveryFee;
  const primaryColor = tenant?.primary_color || '#FF6B35';

  // Centroid of the chosen area — used to center the optional location map.
  const areaCenter = useMemo(() => {
    const city = GHANA_CITIES.find((c) => c.name === selectedCity);
    const n = city?.neighborhoods.find((x) => x.name === selectedArea);
    return n ? ([n.lat, n.lng] as [number, number]) : undefined;
  }, [selectedCity, selectedArea]);

  function useMyLocation() {
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setGeoError('Location not supported on this device. Drag the map instead.');
      setShowMap(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setShowMap(true);
      },
      () => {
        setGeoError('Could not get your location. Drag the map to set it.');
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

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
            price: item.price,
            options: item.options,
          })),
          customer: { name, phone, email: email || undefined },
          deliveryType,
          deliveryAddress: deliveryType === 'delivery' ? address : undefined,
          deliveryNotes: notes || undefined,
          paymentMethod,
          city: deliveryType === 'delivery' ? selectedCity : undefined,
          areaName: deliveryType === 'delivery' ? selectedArea : undefined,
          customerLat: deliveryType === 'delivery' ? customerPin?.lat : undefined,
          customerLng: deliveryType === 'delivery' ? customerPin?.lng : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to place order');
        setLoading(false);
        return;
      }

      // Remember this device's details + last order for prefill & reorder.
      saveCustomer({ name, phone, address: deliveryType === 'delivery' ? address : undefined });
      if (data.order?.order_number) {
        saveLastOrder(slug, data.order.order_number, items);
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
    <div className="max-w-lg mx-auto px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-fade-in">
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
              autoComplete="name"
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
              inputMode="tel"
              autoComplete="tel"
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
              inputMode="email"
              autoComplete="email"
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="checkout-city" className="block text-sm font-medium text-surface-700 mb-1">
                    City
                  </label>
                  <select
                    id="checkout-city"
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value);
                      setSelectedArea('');
                    }}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all text-sm cursor-pointer"
                    style={{ ['--tw-ring-color' as string]: primaryColor } as React.CSSProperties}
                  >
                    <option value="">Select city...</option>
                    {GHANA_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="checkout-area" className="block text-sm font-medium text-surface-700 mb-1">
                    Select Your Area
                  </label>
                  <select
                    id="checkout-area"
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    required
                    disabled={!selectedCity}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all text-sm cursor-pointer disabled:opacity-50"
                    style={{ ['--tw-ring-color' as string]: primaryColor } as React.CSSProperties}
                  >
                    <option value="">Select neighborhood...</option>
                    {(GHANA_CITIES.find((c) => c.name === selectedCity)?.neighborhoods ?? []).map((n) => (
                      <option key={n.name} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedArea && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-surface-700">Pinpoint your location <span className="text-surface-400">(optional)</span></span>
                    <button
                      type="button"
                      onClick={useMyLocation}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                      style={{ color: primaryColor }}
                    >
                      📍 Use my location
                    </button>
                  </div>
                  {geoError && <p className="text-xs text-warning-700">{geoError}</p>}
                  {(showMap || customerPin) && (
                    <LocationPicker
                      center={areaCenter}
                      value={customerPin}
                      onChange={(lat, lng) => setCustomerPin({ lat, lng })}
                    />
                  )}
                  {!showMap && !customerPin && (
                    <button
                      type="button"
                      onClick={() => setShowMap(true)}
                      className="text-xs text-surface-500 underline"
                    >
                      Or drop a pin on the map
                    </button>
                  )}
                  {customerPin && (
                    <p className="text-xs text-success-600">✓ Using your exact location for a precise fee.</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="checkout-address" className="block text-sm font-medium text-surface-700 mb-1">
                  Delivery address
                </label>
                <textarea
                  id="checkout-address"
                  autoComplete="street-address"
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
            <>
              <div className="flex justify-between text-sm text-surface-600">
                <span>Delivery fee {selectedArea ? `(${selectedArea})` : ''}</span>
                <span>{formatGHS(deliveryFee)}</span>
              </div>
              {feeResult?.source === 'distance' && feeResult.breakdown && (
                <p className="text-[11px] text-surface-400">
                  {formatGHS(feeResult.fee)} = base {formatGHS(feeResult.breakdown.base)}
                  {feeResult.breakdown.extraKm === 0
                    ? ` (within ${tenant?.free_delivery_radius_km ?? 3}km)`
                    : ` + ${feeResult.breakdown.extraKm}km × ${formatGHS(feeResult.breakdown.perKm)}`}
                </p>
              )}
              {etaMinutes != null && (
                <div className="flex justify-between text-xs text-surface-500">
                  <span>Est. arrival</span>
                  <span>~{etaMinutes} min</span>
                </div>
              )}
            </>
          )}
          <div className="border-t border-surface-200 pt-2 flex justify-between font-bold text-surface-900">
            <span>Total</span>
            <span>{formatGHS(total)}</span>
          </div>
        </section>

        {notDeliverable && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-xs text-center font-medium animate-fade-in">
            This area is outside the restaurant&apos;s delivery range. Try Pickup or a closer area.
          </div>
        )}

        {/* Limit warning */}
        {belowMinLimit && tenant && (
          <div className="p-3 rounded-xl bg-warning-500/10 text-warning-700 text-xs text-center font-medium animate-fade-in">
            ⚠️ Minimum order amount of {formatGHS(tenant.min_order_amount)} is required by this restaurant. Please add more items to checkout.
          </div>
        )}

        {/* Submit — sticky bar on mobile, inline on desktop */}
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-surface-50 via-surface-50 to-surface-50/0 md:static md:p-0 md:bg-none md:z-auto">
          <div className="max-w-lg mx-auto">
            <button
              type="submit"
              disabled={loading || belowMinLimit || notDeliverable}
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
          </div>
        </div>
      </form>
    </div>
  );
}

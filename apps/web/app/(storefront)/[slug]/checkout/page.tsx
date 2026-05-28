'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { formatGHS } from '@/lib/utils/currency';
import { useParams, useRouter } from 'next/navigation';
import { CartProvider } from '@/hooks/use-cart';
import { ArrowLeft, CreditCard, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';

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
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>(
    'delivery'
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'momo' | 'card' | 'cash_on_delivery'
  >('momo');

  const deliveryFee = deliveryType === 'delivery' ? 10 : 0; // TODO: fetch from tenant config
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-surface-500">Your cart is empty</p>
        <Link
          href={`/${slug}`}
          className="inline-block mt-4 text-sm font-semibold"
          style={{ color: 'var(--brand-primary)' }}
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
    },
    {
      value: 'card' as const,
      label: 'Card',
      desc: 'Visa, Mastercard',
      icon: CreditCard,
    },
    {
      value: 'cash_on_delivery' as const,
      label: 'Pay on Delivery',
      desc: 'Cash when your order arrives',
      icon: Banknote,
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
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
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition-all text-sm"
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
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition-all text-sm"
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
              className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition-all text-sm"
            />
          </div>
        </section>

        {/* Delivery type */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
            Delivery
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                deliveryType === 'delivery'
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-surface-200 hover:border-surface-300'
              }`}
            >
              🚗 Delivery
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                deliveryType === 'pickup'
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-surface-200 hover:border-surface-300'
              }`}
            >
              🏪 Pickup
            </button>
          </div>

          {deliveryType === 'delivery' && (
            <div className="animate-fade-in space-y-3">
              <div>
                <label htmlFor="checkout-address" className="block text-sm font-medium text-surface-700 mb-1">
                  Delivery address
                </label>
                <textarea
                  id="checkout-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="House number, street, area..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition-all text-sm resize-none"
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
                  placeholder="e.g. Call when you arrive"
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition-all text-sm"
                />
              </div>
            </div>
          )}
        </section>

        {/* Payment method */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
            Payment
          </h2>

          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    paymentMethod === method.value
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    style={{
                      color:
                        paymentMethod === method.value
                          ? 'var(--brand-primary)'
                          : undefined,
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-surface-900">
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
              <span>Delivery fee</span>
              <span>{formatGHS(deliveryFee)}</span>
            </div>
          )}
          <div className="border-t border-surface-200 pt-2 flex justify-between font-bold text-surface-900">
            <span>Total</span>
            <span>{formatGHS(total)}</span>
          </div>
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all active:scale-[0.98] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: 'var(--brand-primary)' }}
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

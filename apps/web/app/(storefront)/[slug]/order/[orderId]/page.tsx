import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { formatGHS } from '@/lib/utils/currency';
import { formatDateTime } from '@/lib/utils';
import { CheckCircle, Clock, Phone } from 'lucide-react';
import Link from 'next/link';

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const supabase = createAdminClient();

  // Fetch order with items
  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('id', orderId)
    .single();

  if (!order) notFound();

  // Fetch tenant for branding
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, phone, primary_color')
    .eq('slug', slug)
    .single();

  const primaryColor = tenant?.primary_color || '#FF6B35';
  const isPaid = order.payment_status === 'paid';
  const isCashOnDelivery = order.payment_method === 'cash_on_delivery';

  const statusMessages: Record<string, { icon: string; text: string }> = {
    pending: { icon: '⏳', text: 'Your order has been received and is waiting for confirmation.' },
    confirmed: { icon: '✅', text: 'Your order has been confirmed! We\'re getting it ready.' },
    preparing: { icon: '👨‍🍳', text: 'Your food is being prepared right now!' },
    ready: { icon: '📦', text: 'Your order is ready!' },
    out_for_delivery: { icon: '🚗', text: 'Your order is on the way!' },
    delivered: { icon: '🎉', text: 'Your order has been delivered. Enjoy!' },
    cancelled: { icon: '❌', text: 'This order has been cancelled.' },
  };

  const statusInfo = statusMessages[order.status] || statusMessages.pending;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in">
      {/* Status */}
      <div className="text-center mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl"
          style={{ background: `${primaryColor}15` }}
        >
          {statusInfo.icon}
        </div>
        <h1 className="text-xl font-bold text-surface-900">
          {order.status === 'pending' ? 'Order Placed!' : `Order ${order.status.replace('_', ' ')}`}
        </h1>
        <p className="text-surface-500 mt-2 text-sm">{statusInfo.text}</p>
      </div>

      {/* Order details card */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-surface-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400">Order Number</p>
              <p className="font-bold text-surface-900 text-lg">
                {order.order_number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-400">Total</p>
              <p className="font-bold text-lg" style={{ color: primaryColor }}>
                {formatGHS(Number(order.total))}
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="p-5 space-y-3">
          {(order.order_items as Array<{
            id: string;
            item_name: string;
            quantity: number;
            line_total: number;
            options_json?: Array<{ name: string; price_modifier?: number; priceModifier?: number }>;
          }>)?.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-surface-700 font-semibold animate-fade-in">
                  {item.quantity}× {item.item_name}
                </span>
                <span className="text-surface-500 font-medium">
                  {formatGHS(Number(item.line_total))}
                </span>
              </div>
              {item.options_json && item.options_json.length > 0 && (
                <div className="pl-4 text-xs text-surface-400 space-y-0.5 animate-fade-in">
                  {item.options_json.map((opt, oidx) => (
                    <div key={oidx} className="flex justify-between">
                      <span>+ {opt.name}</span>
                      <span>
                        {Number(opt.price_modifier || opt.priceModifier || 0) > 0
                          ? `+${formatGHS(Number(opt.price_modifier || opt.priceModifier || 0))}`
                          : 'Free'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-surface-100 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-surface-500">
              <span>Subtotal</span>
              <span>{formatGHS(Number(order.subtotal))}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-sm text-surface-500">
                <span>Delivery</span>
                <span>{formatGHS(Number(order.delivery_fee))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment status */}
        <div className="p-5 border-t border-surface-100">
          <div className="flex items-center gap-2">
            {isPaid ? (
              <CheckCircle className="w-5 h-5 text-success-600" />
            ) : (
              <Clock className="w-5 h-5 text-warning-600" />
            )}
            <span className="text-sm font-medium text-surface-700">
              {isPaid
                ? `Paid via ${order.payment_method === 'momo' ? 'Mobile Money' : order.payment_method === 'card' ? 'Card' : 'Cash'}`
                : isCashOnDelivery
                ? 'Pay on delivery'
                : 'Payment pending'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-sm text-surface-500">
            <span>📍 {order.delivery_type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            {order.delivery_address && (
              <span className="truncate">· {order.delivery_address}</span>
            )}
          </div>

          <p className="text-xs text-surface-400 mt-2">
            {formatDateTime(order.created_at)}
          </p>
        </div>
      </div>

      {/* Contact tenant */}
      {tenant?.phone && (
        <div className="mt-6 text-center">
          <a
            href={`tel:${tenant.phone}`}
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: primaryColor }}
          >
            <Phone className="w-4 h-4" />
            Contact {tenant.name}
          </a>
        </div>
      )}

      {/* Back to menu */}
      <div className="mt-4 text-center">
        <Link
          href={`/${slug}`}
          className="text-sm text-surface-400 hover:text-surface-600 transition-colors"
        >
          ← Order more from {tenant?.name || 'this restaurant'}
        </Link>
      </div>
    </div>
  );
}

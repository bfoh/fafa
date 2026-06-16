'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '../../lib/supabase/client';
import { formatGHS } from '../../lib/utils/currency';
import { waLink } from '../../lib/utils/whatsapp';
import { CheckCircle, Clock, Phone, Send, MessageCircle, Loader2, Star, RotateCcw } from 'lucide-react';
import { saveRecentOrder } from '../../lib/utils/customer-prefs';
import { replaceCart } from '../../lib/menu/cart-storage';
import type { CartItem } from '../../hooks/use-cart';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  line_total: number;
  options_json?: Array<{ name: string; price_modifier?: number; priceModifier?: number }>;
}

export interface TrackedOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  delivery_type: string;
  delivery_address: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  estimated_ready_at: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

export interface HistoryEntry {
  to_status: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'restaurant';
  body: string;
  created_at: string;
}

interface Stage {
  key: string;
  label: string;
  desc: string;
  emoji: string;
}

const TERMINAL = new Set(['delivered', 'cancelled']);

function getStages(deliveryType: string): Stage[] {
  const pickup = deliveryType === 'pickup';
  return [
    { key: 'pending', label: 'Order placed', desc: 'We’ve received your order.', emoji: '🧾' },
    { key: 'confirmed', label: 'Confirmed', desc: 'The kitchen accepted your order.', emoji: '✅' },
    { key: 'preparing', label: 'Preparing your food', desc: 'Your meal is being cooked.', emoji: '👨‍🍳' },
    {
      key: 'ready',
      label: pickup ? 'Ready for pickup' : 'Ready',
      desc: pickup ? 'Come grab it while it’s hot!' : 'Packed and waiting for the courier.',
      emoji: '📦',
    },
    ...(pickup
      ? []
      : [{ key: 'out_for_delivery', label: 'On the way', desc: 'The courier is heading to you.', emoji: '🛵' }]),
    {
      key: 'delivered',
      label: pickup ? 'Picked up' : 'Delivered',
      desc: 'Enjoy your meal! 🎉',
      emoji: '🎉',
    },
  ];
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function OrderTracker({
  initialOrder,
  initialHistory,
  slug,
  tenant,
  apiBase = '',
}: {
  initialOrder: TrackedOrder;
  initialHistory: HistoryEntry[];
  slug: string;
  tenant: { name: string; phone: string | null; whatsapp?: string | null; primary_color: string };
  // Backend origin for the order API. Empty (default) = same-origin relative
  // URLs for the web app. The native app passes its NEXT_PUBLIC_API_BASE so
  // polling/messaging/review/reorder reach the deployed backend (the bundle is
  // served from capacitor://localhost, where relative /api has no server).
  apiBase?: string;
}) {
  const [order, setOrder] = useState<TrackedOrder>(initialOrder);
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Bumped by a realtime status broadcast → immediate order refetch.
  const [statusTick, setStatusTick] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const accent = tenant.primary_color || '#FF6B35';

  // Reviews
  const [review, setReview] = useState<{ rating: number; comment: string | null; owner_reply?: string | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Reorder
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Mirror fresher data from the parent. The native order screen polls the order
  // via its own (working, absolute-URL) transport and passes it down as
  // initialOrder/initialHistory, so the timeline updates live even if this
  // component's own /api poll or the realtime socket is unavailable in the
  // WebView. On the web initialOrder is stable, so this is a one-time no-op.
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);
  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  // Remember this order on the device so it shows in the marketplace "Orders" sheet.
  useEffect(() => {
    saveRecentOrder(slug, initialOrder.id, initialOrder.order_number);
  }, [slug, initialOrder.id, initialOrder.order_number]);

  // Live polling — stops once the order reaches a terminal state.
  useEffect(() => {
    if (TERMINAL.has(order.status)) return;

    let active = true;
    async function poll() {
      try {
        const res = await fetch(`${apiBase}/api/orders/${order.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.order) {
          setOrder(data.order as TrackedOrder);
          setHistory((data.history as HistoryEntry[]) || []);
        }
      } catch {
        /* network blip — try again next tick */
      }
    }

    // A status broadcast re-runs this effect (statusTick) — fetch right away.
    if (statusTick > 0) poll();
    const interval = setInterval(poll, 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [order.id, order.status, statusTick]);

  // Realtime: per-order broadcast channel pushes new chat messages and status
  // pokes instantly; the polling above stays as the fallback transport.
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`order-${order.id}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const msg = payload?.message as ChatMessage | undefined;
        if (msg?.id) {
          setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
        }
      })
      .on('broadcast', { event: 'status' }, () => setStatusTick((t) => t + 1))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // Live chat polling.
  useEffect(() => {
    let active = true;
    async function loadMessages() {
      try {
        const res = await fetch(`${apiBase}/api/orders/${order.id}/messages`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setMessages((data.messages as ChatMessage[]) || []);
      } catch {
        /* retry next tick */
      }
    }
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadMessages();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [order.id]);

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      sender: 'customer',
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft('');
    try {
      const res = await fetch(`${apiBase}/api/orders/${order.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const data = await res.json();
        const real = data.message as ChatMessage;
        // The realtime broadcast of our own message can land before this
        // response — swap the optimistic bubble without duplicating.
        setMessages((m) => {
          const rest = m.filter((x) => x.id !== optimistic.id);
          return rest.some((x) => x.id === real.id) ? rest : [...rest, real];
        });
      } else {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  // Load an existing review once the order is delivered.
  useEffect(() => {
    if (order.status !== 'delivered') return;
    let active = true;
    fetch(`${apiBase}/api/orders/${order.id}/review`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.review) {
          setReview(d.review);
          setStars(d.review.rating);
          setReviewComment(d.review.comment || '');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [order.id, order.status]);

  // Rebuild this order in the cart (validated against the live menu) and
  // head to the storefront to check out.
  async function reorder() {
    if (reordering) return;
    setReordering(true);
    setReorderError(null);
    try {
      const res = await fetch(`${apiBase}/api/orders/${order.id}/reorder`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Reorder unavailable');
      const data = (await res.json()) as { items: CartItem[]; skipped: string[] };
      if (!data.items.length) {
        setReorderError('Those items are no longer on the menu.');
        return;
      }
      replaceCart(slug, data.items);
      if (data.skipped.length) {
        setReorderError(`Added to cart — but no longer available: ${data.skipped.join(', ')}.`);
        // Brief pause so the notice is readable before navigating.
        setTimeout(() => router.push(`/${slug}`), 1800);
        return;
      }
      router.push(`/${slug}`);
    } catch {
      setReorderError('Could not rebuild your order. Please try again.');
    } finally {
      setReordering(false);
    }
  }

  async function submitReview() {
    if (!stars || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/orders/${order.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: stars, comment: reviewComment }),
      });
      if (res.ok) {
        const d = await res.json();
        setReview(d.review);
      }
    } catch {
      /* ignore */
    } finally {
      setReviewSubmitting(false);
    }
  }

  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const isLive = !TERMINAL.has(order.status);
  const stages = getStages(order.delivery_type);
  const currentIndex = stages.findIndex((s) => s.key === order.status);

  const stageTime = (key: string): string => {
    const h = history.find((x) => x.to_status === key);
    if (h) return fmtTime(h.created_at);
    if (key === 'pending') return fmtTime(order.created_at);
    if (key === 'confirmed') return fmtTime(order.confirmed_at);
    if (key === 'ready') return fmtTime(order.ready_at);
    if (key === 'delivered') return fmtTime(order.delivered_at);
    return '';
  };

  const isPaid = order.payment_status === 'paid';
  const isCashOnDelivery = order.payment_method === 'cash_on_delivery';

  // ETA — only while still in progress and we have an estimate.
  const eta = (() => {
    if (!order.estimated_ready_at || isDelivered || isCancelled) return null;
    const t = new Date(order.estimated_ready_at).getTime();
    if (Number.isNaN(t)) return null;
    const mins = Math.round((t - Date.now()) / 60000);
    if (mins > 1) return `Estimated ready in ~${mins} min`;
    if (mins >= -2) return 'Should be ready any moment';
    return null;
  })();

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-fade-in">
      {/* ── Live status hero ── */}
      <div className="text-center mb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl relative"
          style={{ background: isCancelled ? 'rgb(239 68 68 / 0.1)' : `${accent}15` }}
        >
          {isCancelled ? '❌' : stages[Math.max(0, currentIndex)]?.emoji ?? '🧾'}
          {isLive && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: accent }}
            />
          )}
        </div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {isCancelled ? 'Order cancelled' : stages[Math.max(0, currentIndex)]?.label ?? 'Order placed'}
        </h1>
        <p className="text-surface-500 mt-2 text-sm">
          {isCancelled
            ? order.cancellation_reason || 'This order has been cancelled.'
            : stages[Math.max(0, currentIndex)]?.desc}
        </p>

        {isLive && (
          <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-success-500/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success-600" />
            </span>
            <span className="text-[11px] font-bold text-success-700 uppercase tracking-wide">Live tracking</span>
          </div>
        )}
        {eta && <p className="text-xs font-semibold mt-2" style={{ color: accent }}>{eta}</p>}
      </div>

      {/* ── Reorder (once the order is done) ── */}
      {(isDelivered || isCancelled) && (
        <div className="mb-5">
          <button
            type="button"
            onClick={reorder}
            disabled={reordering}
            className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-card"
            style={{ background: accent }}
          >
            {reordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Reorder this meal
          </button>
          {reorderError && (
            <p className="text-xs text-center text-warning-600 font-medium mt-2">{reorderError}</p>
          )}
        </div>
      )}

      {/* ── Rate your order (after delivery) ── */}
      {isDelivered && (
        <div className="bg-white rounded-2xl border border-hairline shadow-card p-5 mb-5 text-center">
          <h2 className="text-sm font-bold text-surface-900">
            {review ? 'Your rating' : 'Rate your order'}
          </h2>
          <p className="text-xs text-surface-400 mt-0.5">How was your meal from {tenant.name}?</p>
          <div className="flex justify-center gap-1.5 my-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                className="active:scale-90 transition-transform"
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  className="w-8 h-8"
                  style={{ color: n <= stars ? accent : 'var(--color-surface-300)' }}
                  fill={n <= stars ? accent : 'none'}
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={2}
            placeholder="Add a comment (optional)"
            className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-hairline bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-sm"
          />
          <button
            type="button"
            onClick={submitReview}
            disabled={!stars || reviewSubmitting}
            className="mt-3 w-full py-3 rounded-xl text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: accent }}
          >
            {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {review ? 'Update rating' : 'Submit rating'}
          </button>
          {review && <p className="text-xs text-success-600 font-semibold mt-2">Thanks for your feedback! 🙏</p>}
          {review?.owner_reply && (
            <div className="mt-3 text-left rounded-xl bg-surface-50 border border-surface-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                {tenant.name} replied
              </p>
              <p className="text-sm text-surface-700 mt-0.5">{review.owner_reply}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Timeline ── */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl border border-hairline shadow-card p-5 mb-5">
          <ol className="relative">
            {stages.map((stage, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              const time = stageTime(stage.key);
              const isLast = i === stages.length - 1;
              return (
                <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <span
                      className="absolute left-[15px] top-8 bottom-0 w-0.5"
                      style={{ background: done ? accent : 'var(--color-surface-200)' }}
                    />
                  )}
                  {/* Node */}
                  <div className="relative z-10 shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                        done || current ? 'text-white' : 'bg-surface-100 text-surface-400'
                      }`}
                      style={done || current ? { background: accent } : undefined}
                    >
                      {done ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : current ? (
                        <span className="text-[15px] leading-none">{stage.emoji}</span>
                      ) : (
                        <span className="text-[15px] leading-none opacity-50 grayscale">{stage.emoji}</span>
                      )}
                    </div>
                    {current && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-40"
                        style={{ background: accent }}
                      />
                    )}
                  </div>
                  {/* Label */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold ${done || current ? 'text-surface-900' : 'text-surface-400'}`}>
                        {stage.label}
                      </p>
                      {time && (done || current) && (
                        <span className="text-[11px] text-surface-400 font-medium shrink-0">{time}</span>
                      )}
                    </div>
                    {current && <p className="text-xs text-surface-500 mt-0.5">{stage.desc}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* ── Chat with the restaurant ── */}
      <div className="bg-white rounded-2xl border border-hairline shadow-card overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" style={{ color: accent }} />
          <h2 className="text-sm font-bold text-surface-900">Message {tenant.name}</h2>
        </div>

        <div ref={threadRef} className="max-h-64 overflow-y-auto px-4 py-4 space-y-2.5 scrollbar-thin overscroll-contain-y">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-surface-400 py-6">
              Need to tweak your order or ask a question?<br />Send {tenant.name} a message — they’ll reply here.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender === 'customer';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
                      mine ? 'text-white rounded-br-md' : 'bg-surface-100 text-surface-800 rounded-bl-md'
                    }`}
                    style={mine ? { background: accent } : undefined}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-surface-400'}`}>
                      {fmtTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-surface-100 p-3 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-hairline bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-sm max-h-28"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!draft.trim() || sending}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accent }}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Order details ── */}
      <div className="bg-white rounded-2xl border border-hairline shadow-card overflow-hidden">
        <div className="p-5 border-b border-surface-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400">Order Number</p>
              <p className="font-bold text-surface-900 text-lg">{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-400">Total</p>
              <p className="font-bold text-lg" style={{ color: accent }}>
                {formatGHS(Number(order.total))}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-surface-700 font-semibold">
                  {item.quantity}× {item.item_name}
                </span>
                <span className="text-surface-500 font-medium">{formatGHS(Number(item.line_total))}</span>
              </div>
              {item.options_json && item.options_json.length > 0 && (
                <div className="pl-4 text-xs text-surface-400 space-y-0.5">
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
            {order.delivery_address && <span className="truncate">· {order.delivery_address}</span>}
          </div>
        </div>
      </div>

      {/* ── Contact + back ── */}
      {(tenant.phone || tenant.whatsapp) && (
        <div className="mt-6 flex items-center justify-center gap-2.5">
          {tenant.whatsapp && (
            <a
              href={waLink(tenant.whatsapp, `Hi ${tenant.name}, about my order #${order.order_number}:`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-semibold transition-colors hover:bg-surface-50"
              style={{ color: accent }}
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
          )}
        </div>
      )}

      <div className="mt-4 text-center space-y-2">
        <Link href={`/${slug}`} className="block text-sm text-surface-400 hover:text-surface-600 transition-colors">
          ← Order more from {tenant.name}
        </Link>
        <Link href="/" className="block text-sm font-semibold transition-colors" style={{ color: accent }}>
          Browse more restaurants on Didi
        </Link>
      </div>
    </div>
  );
}

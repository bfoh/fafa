'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { Sparkles, X, Send, Loader2, Plus, ShoppingBag, Check, ExternalLink, Mic } from 'lucide-react';
import { formatGHS } from '@/lib/utils/currency';
import { addToCart, cartCount } from '@/lib/menu/cart-storage';
import { loadLastOrder, loadCustomer } from '@/lib/utils/customer-prefs';
import { getConversationId, setAttribution, pingOutcome } from '@/lib/adepa/session';

const QUICK_REPLIES = ["What's popular?", 'Build me a bowl', 'Are you open now?', 'Track my order'];

interface Dish { id: string; name: string; price: number; description?: string | null; image?: string | null; isChopBar?: boolean; tenantSlug?: string | null; tenantName?: string | null }
interface Kitchen { name: string; slug: string; deliveryFee: number; openNow?: boolean }
interface OrderStatus { found: boolean; orderNumber?: string; status?: string; total?: number }
interface Bowl { itemId: string; name: string; basePrice: number; selected: Array<{ name: string; priceModifier: number }>; total: number; unmatched: string[] }
interface SpeechResultLike { results: Array<Array<{ transcript: string }>> }
interface SpeechRecognitionLike { lang: string; interimResults: boolean; maxAlternatives: number; onresult: (e: SpeechResultLike) => void; onend: () => void; onerror: () => void; start: () => void }

export function AdepaWidget({ tenantSlug }: { tenantSlug?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [cartN, setCartN] = useState(0);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [firstName, setFirstName] = useState('');
  const [usual, setUsual] = useState('');
  const [listening, setListening] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const convIdRef = useRef<string>('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/adepa/chat', body: { tenantSlug } }),
  });

  // Stable per-session conversation id (lazily created on the client).
  function convId(): string {
    if (!convIdRef.current) convIdRef.current = getConversationId();
    return convIdRef.current;
  }

  useEffect(() => {
    fetch('/api/adepa/config').then((r) => r.json()).then((d) => setEnabled(Boolean(d.enabled))).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (open && tenantSlug) setCartN(cartCount(tenantSlug));
  }, [open, tenantSlug, messages]);

  // Personalisation from this device (returning customer + last order).
  useEffect(() => {
    if (!open) return;
    const c = loadCustomer();
    if (c?.name) setFirstName(c.name.trim().split(/\s+/)[0]);
    if (tenantSlug) {
      const last = loadLastOrder(tenantSlug);
      if (last?.items?.length) setUsual(last.items[0].name);
    }
  }, [open, tenantSlug]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  if (!enabled) return null;

  const busy = status === 'submitted' || status === 'streaming';

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t }, { body: { conversationId: convId() } });
    setInput('');
  }

  function handleAdd(d: Dish) {
    if (!tenantSlug) return;
    const n = addToCart(tenantSlug, {
      menuItemId: d.id, name: d.name, price: d.price, quantity: 1, options: [], imageUrl: d.image ?? null,
    });
    setCartN(n);
    setAdded((p) => ({ ...p, [d.id]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [d.id]: false })), 1500);
    pingOutcome(convId(), 'added_to_cart');
  }

  function handleAddBowl(b: Bowl) {
    if (!tenantSlug) return;
    const n = addToCart(tenantSlug, {
      menuItemId: b.itemId, name: b.name, price: b.basePrice, quantity: 1, options: b.selected, imageUrl: null,
    });
    setCartN(n);
    setAdded((p) => ({ ...p, [b.itemId]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [b.itemId]: false })), 1500);
    pingOutcome(convId(), 'added_to_cart');
  }

  function startVoice() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { send('I want to talk — voice not supported on this device'); return; }
    const rec = new SR();
    rec.lang = 'en-GH';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: SpeechResultLike) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function handleReorder() {
    if (!tenantSlug) return;
    const last = loadLastOrder(tenantSlug);
    if (!last || !last.items.length) {
      send('I want to reorder my last meal');
      return;
    }
    let n = 0;
    last.items.forEach((it) => { n = addToCart(tenantSlug, it); });
    setCartN(n);
    pingOutcome(convId(), 'added_to_cart');
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Fafa"
          className="fixed z-40 bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 w-14 h-14 rounded-full text-white shadow-xl shadow-black/20 press flex items-center justify-center"
          style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}
        >
          <Sparkles className="w-6 h-6" />
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-brand-500" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed z-50 inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[85dvh] md:max-h-[640px] md:h-[640px] animate-slide-up overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 text-white shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">Fafa</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> Your food concierge</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15"><X className="w-5 h-5" /></button>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-canvas scrollbar-thin">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3"><Sparkles className="w-7 h-7 text-brand-500" /></div>
                  <p className="font-semibold text-surface-900">{firstName ? `Welcome back, ${firstName} 👋` : "Hi, I'm Fafa 👋"}</p>
                  <p className="text-sm text-surface-500 mt-1">
                    {usual ? `Want the usual (${usual}), or something new?` : "Ask me what's good, find a dish, or track an order."}
                  </p>
                </div>
              )}

              {messages.map((m) => {
                const mine = m.role === 'user';
                return (
                  <div key={m.id} className="space-y-2">
                    {(m.parts || []).map((part, idx) => {
                      if (part.type === 'text') {
                        if (!part.text) return null;
                        return (
                          <div key={idx} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${mine ? 'text-white rounded-br-md' : 'bg-white border border-hairline shadow-sm text-surface-800 rounded-bl-md'}`}
                              style={mine ? { backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' } : undefined}
                            >
                              {part.text}
                            </div>
                          </div>
                        );
                      }
                      // Tool result cards (grounded data only).
                      const p = part as { type: string; state?: string; output?: unknown };
                      if (!p.type.startsWith('tool-') || p.state !== 'output-available') return null;

                      if ((p.type === 'tool-search_menu' || p.type === 'tool-get_recommendations') && Array.isArray(p.output)) {
                        const dishes = p.output as Dish[];
                        if (!dishes.length) return null;
                        return (
                          <div key={idx} className="space-y-2">
                            {dishes.map((d) => (
                              <div key={d.id} className="flex items-center gap-3 bg-white border border-hairline rounded-2xl p-2.5 shadow-sm">
                                {d.image ? (
                                  <img src={d.image} alt={d.name} className="w-12 h-12 rounded-xl object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-lg">🍽️</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-surface-900 truncate">{d.name}</p>
                                  <p className="text-xs font-bold text-brand-600">{formatGHS(d.price)}</p>
                                  {!tenantSlug && d.tenantName && (
                                    <p className="text-[11px] text-surface-400 truncate">{d.tenantName}</p>
                                  )}
                                </div>
                                {tenantSlug ? (
                                  d.isChopBar ? (
                                    <Link href={`/${tenantSlug}`} className="px-3 h-9 inline-flex items-center rounded-xl border border-hairline text-xs font-semibold text-surface-700">Customise</Link>
                                  ) : (
                                    <button onClick={() => handleAdd(d)} className="px-3 h-9 inline-flex items-center gap-1 rounded-xl text-white text-xs font-semibold press" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                                      {added[d.id] ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                      {added[d.id] ? 'Added' : 'Add'}
                                    </button>
                                  )
                                ) : d.tenantSlug ? (
                                  <Link href={`/${d.tenantSlug}`} className="px-3 h-9 inline-flex items-center gap-1 rounded-xl text-white text-xs font-semibold press shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                                    Order <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      if (p.type === 'tool-track_order') {
                        const o = p.output as OrderStatus;
                        if (!o?.found) return null;
                        return (
                          <div key={idx} className="bg-white border border-hairline rounded-2xl p-3 shadow-sm text-sm">
                            <p className="font-semibold text-surface-900">Order {o.orderNumber}</p>
                            <p className="text-surface-600 capitalize">Status: {String(o.status).replace(/_/g, ' ')}</p>
                            {typeof o.total === 'number' && <p className="text-xs text-surface-500 mt-0.5">{formatGHS(o.total)}</p>}
                          </div>
                        );
                      }

                      if (p.type === 'tool-customise_chop_bar') {
                        const r = p.output as { found?: boolean; bowl?: Bowl };
                        if (!r?.found || !r.bowl) return null;
                        const b = r.bowl;
                        return (
                          <div key={idx} className="bg-white border border-hairline rounded-2xl p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-surface-900">{b.name}</p>
                              <p className="text-sm font-bold text-brand-600">{formatGHS(b.total)}</p>
                            </div>
                            {b.selected.length > 0 ? (
                              <ul className="mt-1.5 space-y-0.5">
                                {b.selected.map((o, i) => (
                                  <li key={i} className="flex items-center justify-between text-xs text-surface-600">
                                    <span>· {o.name}</span>
                                    <span className="text-surface-400">{o.priceModifier > 0 ? `+${formatGHS(o.priceModifier)}` : ''}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-xs text-surface-400">Base bowl — tell me what to add.</p>
                            )}
                            {b.unmatched.length > 0 && (
                              <p className="mt-1.5 text-[11px] text-amber-600">Not on the menu: {b.unmatched.join(', ')}</p>
                            )}
                            {tenantSlug && (
                              <button onClick={() => handleAddBowl(b)} className="mt-2.5 w-full h-9 inline-flex items-center justify-center gap-1 rounded-xl text-white text-xs font-semibold press" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                                {added[b.itemId] ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {added[b.itemId] ? 'Added' : 'Add bowl'}
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (p.type === 'tool-find_kitchens' && Array.isArray(p.output)) {
                        const kitchens = p.output as Kitchen[];
                        if (!kitchens.length) return null;
                        return (
                          <div key={idx} className="space-y-2">
                            {kitchens.map((k) => (
                              <Link key={k.slug} href={`/${k.slug}`} className="flex items-center justify-between gap-2 bg-white border border-hairline rounded-2xl p-3 shadow-sm">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-surface-900 truncate">{k.name}</p>
                                  <p className="text-xs text-surface-500">Delivery {formatGHS(k.deliveryFee)}{k.openNow === false ? ' · closed' : ''}</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-surface-400 shrink-0" />
                              </Link>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                );
              })}

              {busy && (
                <div className="flex justify-start"><div className="px-3.5 py-2.5 rounded-2xl bg-white border border-hairline"><Loader2 className="w-4 h-4 animate-spin text-surface-400" /></div></div>
              )}
            </div>

            {/* Cart bar */}
            {cartN > 0 && tenantSlug && (
              <Link href={`/${tenantSlug}/checkout`} onClick={() => { setAttribution(tenantSlug, convId()); pingOutcome(convId(), 'checkout'); }} className="mx-4 mb-2 flex items-center justify-between px-4 h-11 rounded-xl text-white text-sm font-semibold press shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> {cartN} in cart</span>
                <span>Checkout →</span>
              </Link>
            )}

            {messages.length === 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
                {tenantSlug && usual && (
                  <button onClick={handleReorder} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 press">Order the usual</button>
                )}
                {QUICK_REPLIES.map((q) => (
                  <button key={q} onClick={() => send(q)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-100 text-surface-600 press">{q}</button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-hairline shrink-0">
              <button type="button" onClick={startVoice} aria-label="Speak" className={`w-11 h-11 rounded-xl flex items-center justify-center press shrink-0 ${listening ? 'bg-error-500/10 text-error-600' : 'bg-surface-100 text-surface-500'}`}>
                <Mic className={`w-5 h-5 ${listening ? 'animate-pulse' : ''}`} />
              </button>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask Fafa…'} className="flex-1 px-4 py-2.5 rounded-xl border border-hairline bg-white text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-11 h-11 rounded-xl text-white flex items-center justify-center press disabled:opacity-40" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

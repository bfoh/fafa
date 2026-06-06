'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { Sparkles, X, Send, Loader2, Plus, ShoppingBag, ExternalLink, Mic, Volume2, VolumeX } from 'lucide-react';
import { formatGHS } from '@/lib/utils/currency';
import { addToCart, cartCount } from '@/lib/menu/cart-storage';
import { loadLastOrder, loadCustomer } from '@/lib/utils/customer-prefs';
import { getConversationId, setAttribution, pingOutcome } from '@/lib/adepa/session';
import { correctFoodNames } from '@/lib/adepa/food-vocab';

const QUICK_REPLIES = ["What's popular?", 'Build me a bowl', 'Are you open now?', 'Track my order'];

interface Dish { id: string; name: string; price: number; description?: string | null; image?: string | null; isChopBar?: boolean; tenantSlug?: string | null; tenantName?: string | null }
interface Kitchen { name: string; slug: string; deliveryFee: number; openNow?: boolean }
interface OrderStatus { found: boolean; orderNumber?: string; status?: string; total?: number }
interface Bowl { itemId: string; name: string; basePrice: number; selected: Array<{ name: string; priceModifier: number }>; total: number; unmatched: string[] }
interface SpeechResultLike { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }
interface SpeechRecognitionLike { lang: string; interimResults: boolean; maxAlternatives: number; onresult: (e: SpeechResultLike) => void; onend: () => void; onerror: (e?: { error?: string }) => void; start: () => void; stop: () => void }

export function AdepaWidget({ tenantSlug }: { tenantSlug?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [cartN, setCartN] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [usual, setUsual] = useState('');
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceErr, setVoiceErr] = useState('');
  const [speakOn, setSpeakOn] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const convIdRef = useRef<string>('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const handsFreeRef = useRef(false); // continuous voice conversation
  const openRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/adepa/chat', body: { tenantSlug } }),
  });

  // Stable per-session conversation id (lazily created on the client).
  function convId(): string {
    if (!convIdRef.current) convIdRef.current = getConversationId();
    return convIdRef.current;
  }

  // Strip markdown + emojis so the spoken text sounds natural.
  function speakable(t: string): string {
    return t
      .replace(/\*\*|__|[*_`#>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Flip currency so "GH₵ 45" or "GH₵45" becomes "45 cedis"
      .replace(/GH₵\s*([\d.,]+)/g, '$1 cedis')
      .replace(/GH₵/g, 'cedis')
      // Phonetic spellings for Ghanaian foods so the English TTS pronounces them better
      .replace(/\bJollof\b/gi, 'Jaw-loff')
      .replace(/\bWaakye\b/gi, 'Wah-chay')
      .replace(/\bBanku\b/gi, 'Ban-koo')
      .replace(/\bKenkey\b/gi, 'Ken-kay')
      .replace(/\bFufu\b/gi, 'Foo-foo')
      .replace(/\bShito\b/gi, 'Shee-toe')
      .replace(/\bKelewele\b/gi, 'Kelly-welly')
      .replace(/\bTuo Zaafi\b/gi, 'Too-oh Zaa-fee')
      .replace(/\bKoose\b/gi, 'Koo-say')
      .replace(/\bAmpesi\b/gi, 'Am-peh-see')
      .replace(/\bSobolo\b/gi, 'So-bo-lo')
      // Strip emojis so TTS doesn't say "waving hand" etc.
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // iOS/Safari only allow speechSynthesis to start from a user gesture; speak a
  // silent utterance on the first interaction to unlock later auto-reads.
  function primeSpeech() {
    if (primedRef.current || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      primedRef.current = true;
    } catch { /* ignore */ }
  }

  function speak(text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel(); // drop any queued/earlier utterance
      const u = new SpeechSynthesisUtterance(speakable(text));
      const v = voiceRef.current;
      if (v) u.voice = v;
      u.lang = v?.lang || 'en-GH';
      u.rate = 1.02;
      u.pitch = 1.12; // a touch higher — warmer, more feminine
      // After Fafa finishes speaking, resume listening (hands-free convo).
      u.onend = () => maybeRelisten();
      synth.speak(u);
    } catch { /* ignore */ }
  }

  // Choose a warm female English voice, preferring West-African / Ghanaian accents.
  // Voice names vary wildly across OS/browser; this covers macOS, iOS, Windows, Chrome, Android.
  function chooseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    // Broad pattern: known female voice names across platforms.
    const female = (v: SpeechSynthesisVoice) =>
      /female|woman|samantha|karen|tessa|moira|fiona|serena|amira|zira|aria|sonia|libby|nora|joana|ava|allison|victoria|isha|stephanie|susan|veena|rishi|google uk english female|google us english/i.test(v.name)
      && !/male(?!.*female)/i.test(v.name); // exclude "male" unless also "female"
    // "Isha" on macOS is a warm West-African / Ghanaian-accented English voice — ideal.
    const isIsha = (v: SpeechSynthesisVoice) => /isha/i.test(v.name) && /^en/i.test(v.lang);
    const byLang = (re: RegExp) =>
      voices.find((v) => re.test(v.lang) && female(v)) || voices.find((v) => re.test(v.lang));
    return (
      // 1. Best match: Isha (macOS West-African voice)
      voices.find(isIsha) ||
      // 2. Any en-GH female voice
      byLang(/^en[-_]GH/i) ||
      // 3. en-NG (Nigeria — closest common West-African accent)
      byLang(/^en[-_]NG/i) ||
      // 4. Any English female voice
      voices.find((v) => /^en/i.test(v.lang) && female(v)) ||
      // 5. en-GB fallback (British)
      byLang(/^en[-_]GB/i) ||
      // 6. Any English voice
      byLang(/^en/i) ||
      // 7. Last resort
      voices[0] ||
      null
    );
  }

  // Resume listening after a reply, once Fafa stops talking (hands-free mode).
  function maybeRelisten() {
    if (!handsFreeRef.current || !openRef.current || recRef.current) return;
    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
      setTimeout(maybeRelisten, 400); // still talking — wait
      return;
    }
    beginListen();
  }

  function setHF(v: boolean) {
    handsFreeRef.current = v;
    setHandsFree(v);
  }

  function toggleSpeak() {
    primeSpeech();
    setSpeakOn((on) => {
      const next = !on;
      try { localStorage.setItem('fafa_speak', next ? '1' : '0'); } catch { /* ignore */ }
      if (!next && typeof window !== 'undefined') window.speechSynthesis?.cancel();
      return next;
    });
  }

  useEffect(() => {
    fetch('/api/adepa/config').then((r) => r.json()).then((d) => setEnabled(Boolean(d.enabled))).catch(() => setEnabled(false));
    try {
      const v = localStorage.getItem('fafa_speak');
      if (v != null) setSpeakOn(v === '1');
    } catch { /* ignore */ }
  }, []);

  // Load + pick the spoken voice (voices arrive async on most browsers).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => { voiceRef.current = chooseVoice(window.speechSynthesis.getVoices()); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep openRef in sync; tearing down voice when the drawer closes.
  useEffect(() => {
    openRef.current = open;
    if (!open) {
      setHF(false);
      setListening(false);
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      try { recRef.current?.stop(); recRef.current = null; } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When a turn finishes: speak the reply (which then resumes listening), or —
  // if muted but hands-free — just resume listening after a short beat.
  useEffect(() => {
    if (!open) return;
    if (status === 'submitted' || status === 'streaming') return; // wait until fully streamed
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (spokenRef.current.has(last.id)) return;
    spokenRef.current.add(last.id);
    const text = (last.parts || [])
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && Boolean((p as { text?: string }).text))
      .map((p) => p.text)
      .join(' ')
      .trim();
    const canTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (speakOn && canTTS && text) {
      speak(text); // maybeRelisten() fires on utterance end
    } else if (handsFreeRef.current) {
      setTimeout(maybeRelisten, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, speakOn, open]);

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
    primeSpeech();
    sendMessage({ text: t }, { body: { conversationId: convId() } });
    setInput('');
  }

  // Stage the cart + record the funnel, then close the drawer. Navigation to
  // checkout is driven by the enclosing <Link> (reliable from this layout-level
  // component, where router.push did not navigate). Customer can tap back at
  // checkout to add more dishes from the kitchen's menu.
  function stageAdd(slug: string, item: Parameters<typeof addToCart>[1]) {
    const n = addToCart(slug, item);
    setCartN(n);
    setAttribution(slug, convId());
    pingOutcome(convId(), 'added_to_cart');
    pingOutcome(convId(), 'checkout');
    setOpen(false);
  }

  function handleAdd(d: Dish) {
    const slug = tenantSlug || d.tenantSlug || '';
    if (!slug) return;
    stageAdd(slug, {
      menuItemId: d.id, name: d.name, price: d.price, quantity: 1, options: [], imageUrl: d.image ?? null,
    });
  }

  function handleAddBowl(b: Bowl) {
    if (!tenantSlug) return;
    stageAdd(tenantSlug, {
      menuItemId: b.itemId, name: b.name, price: b.basePrice, quantity: 1, options: b.selected, imageUrl: null,
    });
  }

  // Mic button: toggles the hands-free conversation on/off.
  function onMicTap() {
    primeSpeech();
    if (recRef.current) {
      // Listening → user wants to stop the whole conversation loop.
      setHF(false);
      try { recRef.current.stop(); } catch { /* ignore */ }
      return;
    }
    setHF(true);
    beginListen();
  }

  // Start one listening turn. The conversation loop is driven by maybeRelisten()
  // after each reply, so this only handles a single capture.
  function beginListen() {
    if (recRef.current) return; // already listening
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setVoiceErr('Voice not supported here — type instead.'); setHF(false); return; }

    let rec: SpeechRecognitionLike;
    try { rec = new SR(); } catch {
      // In hands-free mode, retry after a beat instead of dying.
      if (handsFreeRef.current && openRef.current) { setTimeout(() => beginListen(), 500); return; }
      setVoiceErr('Could not start voice.'); return;
    }
    recRef.current = rec;
    rec.lang = 'en-GH';
    rec.interimResults = true; // show words as they come; pick the final to send
    rec.maxAlternatives = 1;

    let sent = false;
    let lastText = '';
    // Send as soon as we have any transcript — don't depend on onend, which is
    // unreliable across browsers (notably iOS Safari).
    const fire = (text: string) => {
      const t = correctFoodNames(text.trim());
      if (!t || sent) return;
      sent = true;
      setInput(t);
      send(t);
    };

    rec.onresult = (e: SpeechResultLike) => {
      const res = e.results[e.results.length - 1];
      lastText = res?.[0]?.transcript ?? '';
      setInput(lastText);
      // Final result → send immediately.
      if ((res as { isFinal?: boolean })?.isFinal) fire(lastText);
    };
    rec.onerror = (ev?: { error?: string }) => {
      setListening(false);
      recRef.current = null;
      const err = ev?.error;
      // Only 'not-allowed' is truly fatal.
      if (err === 'not-allowed') {
        setHF(false);
        setVoiceErr('Mic blocked — enable it in settings.');
        return;
      }
      // If user manually stopped it, or it's just silence, don't show a red error.
      if (err === 'aborted' || err === 'no-speech') {
        // In hands-free mode, silence ('no-speech') should auto-retry.
        if (err === 'no-speech' && handsFreeRef.current && openRef.current) {
          setTimeout(() => beginListen(), 400);
        }
        return;
      }
      // In hands-free mode, auto-retry on any other network/capture error.
      if (handsFreeRef.current && openRef.current) {
        setTimeout(() => beginListen(), 400);
        return;
      }
      // Show error to user.
      if (err) {
        setVoiceErr('Voice error — try again.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      // Fallback: if a final result never flagged isFinal, send the last text.
      if (!sent && lastText.trim()) fire(lastText);
      // In hands-free mode, if nothing was said, keep listening.
      if (!sent && handsFreeRef.current && openRef.current) {
        setTimeout(() => beginListen(), 300);
      }
    };

    setVoiceErr('');
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
      // On mobile, programmatic start can fail — retry in hands-free mode.
      if (handsFreeRef.current && openRef.current) {
        setTimeout(() => beginListen(), 500);
      }
    }
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
          onClick={() => {
            setOpen(true);
            if (messages.length === 0 && speakOn) {
              const text = firstName
                ? `Welcome back, ${firstName}. ${usual ? `Want the usual, ${usual}? Or something new?` : "What can I get for you today?"}`
                : "Hi, I'm Fafa. Ask me what's good, find a dish, or track an order.";
              speak(text);
              // Start hands-free continuous conversation automatically
              setHF(true);
            }
          }}
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
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); setOpen(false); }} />
          <div className="fixed z-50 inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[85dvh] md:max-h-[640px] md:h-[640px] animate-slide-up overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 text-white shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">Fafa</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> Your food concierge</p>
              </div>
              <button onClick={toggleSpeak} aria-label={speakOn ? 'Mute voice' : 'Unmute voice'} aria-pressed={speakOn} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15">{speakOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
              <button onClick={() => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); setOpen(false); }} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15"><X className="w-5 h-5" /></button>
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
                                  {d.tenantName && (
                                    <p className="text-[11px] text-surface-400 truncate">{d.tenantName}</p>
                                  )}
                                </div>
                                {tenantSlug && d.isChopBar ? (
                                  <Link href={`/${tenantSlug}`} onClick={() => setOpen(false)} className="px-3 h-9 inline-flex items-center rounded-xl border border-hairline text-xs font-semibold text-surface-700">Customise</Link>
                                ) : (tenantSlug || d.tenantSlug) ? (
                                  <Link href={`/${tenantSlug || d.tenantSlug}/checkout`} onClick={() => handleAdd(d)} className="px-3 h-9 inline-flex items-center gap-1 rounded-xl text-white text-xs font-semibold press shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                                    <Plus className="w-4 h-4" /> Add
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
                              <Link href={`/${tenantSlug}/checkout`} onClick={() => handleAddBowl(b)} className="mt-2.5 w-full h-9 inline-flex items-center justify-center gap-1 rounded-xl text-white text-xs font-semibold press" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
                                <Plus className="w-4 h-4" /> Add bowl
                              </Link>
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
                              <Link key={k.slug} href={`/${k.slug}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 bg-white border border-hairline rounded-2xl p-3 shadow-sm">
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
              <Link href={`/${tenantSlug}/checkout`} onClick={() => { setAttribution(tenantSlug, convId()); pingOutcome(convId(), 'checkout'); setOpen(false); }} className="mx-4 mb-2 flex items-center justify-between px-4 h-11 rounded-xl text-white text-sm font-semibold press shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}>
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

            {voiceErr && (
              <p className="px-4 pt-1 text-[11px] text-error-600 shrink-0">{voiceErr}</p>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-hairline shrink-0">
              <button type="button" onClick={onMicTap} aria-label={listening ? 'Stop listening' : handsFree ? 'Stop conversation' : 'Start voice conversation'} className={`w-11 h-11 rounded-xl flex items-center justify-center press shrink-0 ${listening ? 'bg-error-500/10 text-error-600' : handsFree ? 'bg-brand-500/10 text-brand-600 ring-2 ring-brand-500/30' : 'bg-surface-100 text-surface-500'}`}>
                <Mic className={`w-5 h-5 ${listening ? 'animate-pulse' : handsFree ? 'animate-pulse' : ''}`} />
              </button>
              <input value={input} onChange={(e) => { setInput(e.target.value); if (voiceErr) setVoiceErr(''); }} placeholder={listening ? 'Listening…' : handsFree && busy ? 'Fafa is thinking…' : handsFree ? 'Conversation active…' : 'Ask Fafa…'} className="flex-1 px-4 py-2.5 rounded-xl border border-hairline bg-white text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
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

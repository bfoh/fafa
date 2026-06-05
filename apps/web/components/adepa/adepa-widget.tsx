'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

const QUICK_REPLIES = ["What's popular?", 'Something under ₵40', 'Are you open now?', 'Track my order'];

export function AdepaWidget({ tenantSlug }: { tenantSlug?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/adepa/chat', body: { tenantSlug } }),
  });

  // Only render once we know Adepa is configured (dormant otherwise).
  useEffect(() => {
    fetch('/api/adepa/config')
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  if (!enabled) return null;

  const busy = status === 'submitted' || status === 'streaming';

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput('');
  }

  function textOf(m: (typeof messages)[number]): string {
    return (m.parts || [])
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Adepa"
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
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-3.5 text-white shrink-0"
              style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">Adepa</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> Your food concierge
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thread */}
            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-canvas scrollbar-thin">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-7 h-7 text-brand-500" />
                  </div>
                  <p className="font-semibold text-surface-900">Hi, I&apos;m Adepa 👋</p>
                  <p className="text-sm text-surface-500 mt-1">Ask me what&apos;s good, find a dish, or track an order.</p>
                </div>
              )}
              {messages.map((m) => {
                const mine = m.role === 'user';
                const text = textOf(m);
                if (!text) return null;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        mine ? 'text-white rounded-br-md' : 'bg-white border border-hairline shadow-sm text-surface-800 rounded-bl-md'
                      }`}
                      style={mine ? { backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' } : undefined}
                    >
                      {text}
                    </div>
                  </div>
                );
              })}
              {busy && (
                <div className="flex justify-start">
                  <div className="px-3.5 py-2.5 rounded-2xl bg-white border border-hairline">
                    <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick replies */}
            {messages.length === 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} onClick={() => send(q)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-100 text-surface-600 press">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-hairline shrink-0"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Adepa…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-hairline bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="w-11 h-11 rounded-xl text-white flex items-center justify-center press disabled:opacity-40"
                style={{ backgroundImage: 'linear-gradient(135deg, #FF8243, #E85520)' }}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

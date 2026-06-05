'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';
import { formatGHS } from '@/lib/utils/currency';
import { Loader2, Sparkles, MessageSquare, ShoppingBag, TrendingUp } from 'lucide-react';

interface Conv {
  channel: string;
  outcome: string;
  order_total: number | null;
  created_at: string;
}

const FUNNEL: Array<{ key: string; label: string }> = [
  { key: 'browsing', label: 'Browsing' },
  { key: 'added_to_cart', label: 'Added to cart' },
  { key: 'checkout', label: 'Reached checkout' },
  { key: 'ordered', label: 'Ordered' },
];

export default function AdepaSettingsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [localVoice, setLocalVoice] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const tId = await getResolvedTenantIdClient(supabase, session);
        if (!tId) return;
        setTenantId(tId);

        const { data: tenant } = await supabase
          .from('tenants')
          .select('adepa_local_voice')
          .eq('id', tId)
          .single();
        if (tenant) setLocalVoice(Boolean(tenant.adepa_local_voice));

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows } = await supabase
          .from('adepa_conversations')
          .select('channel, outcome, order_total, created_at')
          .eq('tenant_id', tId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (rows) setConvs(rows as Conv[]);
      } catch (err) {
        console.error('Failed to load Adepa settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleVoice(next: boolean) {
    if (!tenantId) return;
    setLocalVoice(next);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ adepa_local_voice: next, updated_at: new Date().toISOString() })
        .eq('id', tenantId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save local voice:', err);
      setLocalVoice(!next); // revert
      alert('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6 text-center">
        <p className="text-surface-500 font-medium">No restaurant found for this account.</p>
      </div>
    );
  }

  // ─── Metrics ──────────────────────────────────────────────
  const total = convs.length;
  const counts = (k: string) => convs.filter((c) => c.outcome === k).length;
  const atLeast = (rank: number) => {
    const order = ['browsing', 'added_to_cart', 'checkout', 'ordered'];
    const escalatedRank = -1; // not in the linear funnel
    return convs.filter((c) => {
      const i = order.indexOf(c.outcome);
      return i >= rank && i !== escalatedRank;
    }).length;
  };
  const ordered = counts('ordered');
  const conversion = total ? Math.round((ordered / total) * 100) : 0;
  const orderedRows = convs.filter((c) => c.outcome === 'ordered' && c.order_total != null);
  const revenue = orderedRows.reduce((s, c) => s + Number(c.order_total), 0);
  const aov = orderedRows.length ? revenue / orderedRows.length : 0;
  const waCount = convs.filter((c) => c.channel === 'whatsapp').length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" /> Fafa — AI Concierge
        </h2>
        <p className="text-xs text-surface-400 mt-0.5">
          Tune your concierge&apos;s voice and see how chats turn into orders (last 30 days).
        </p>
      </div>

      {/* Local voice toggle */}
      <div className="bg-white rounded-2xl border border-hairline p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-surface-800 text-sm">Local voice</p>
            <p className="text-surface-400 text-xs mt-0.5 leading-relaxed">
              Let Fafa sprinkle in light Ghanaian expressions
              (&ldquo;Chale, good choice 👌&rdquo;). Off keeps it neutral-warm.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={localVoice}
            disabled={saving}
            onClick={() => toggleVoice(!localVoice)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
              localVoice ? 'bg-brand-500' : 'bg-surface-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                localVoice ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<MessageSquare className="w-4 h-4" />} label="Conversations" value={String(total)} />
        <Stat icon={<ShoppingBag className="w-4 h-4" />} label="Orders" value={String(ordered)} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="Conversion" value={`${conversion}%`} />
        <Stat icon={<ShoppingBag className="w-4 h-4" />} label="Avg order" value={formatGHS(aov)} />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-2xl border border-hairline p-4 shadow-sm">
        <p className="text-sm font-semibold text-surface-800 mb-3">Chat → order funnel</p>
        {total === 0 ? (
          <p className="text-xs text-surface-400 italic py-4 text-center">
            No conversations yet. Fafa appears on your storefront once an AI key is set.
          </p>
        ) : (
          <div className="space-y-2.5">
            {FUNNEL.map((step, i) => {
              const n = atLeast(i);
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={step.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-600 font-medium">{step.label}</span>
                    <span className="text-surface-400">{n} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {waCount > 0 && (
        <p className="text-xs text-surface-400">
          Includes {waCount} WhatsApp conversation{waCount === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-hairline p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-surface-400">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <p className="text-xl font-bold text-surface-900 mt-1">{value}</p>
    </div>
  );
}

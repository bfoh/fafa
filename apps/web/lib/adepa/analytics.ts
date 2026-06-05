import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Conversation observability for Adepa. Every helper here is best-effort and
 * MUST NOT throw — analytics can never break a customer's chat. Writes use the
 * service-role admin client (RLS-bypassing); the dashboard reads under RLS.
 */

export type AdepaOutcome =
  | 'browsing'
  | 'added_to_cart'
  | 'checkout'
  | 'ordered'
  | 'escalated';

// Funnel ranking so an outcome only ever moves forward (never downgrade a
// session that already ordered back to "browsing").
const OUTCOME_RANK: Record<AdepaOutcome, number> = {
  browsing: 0,
  added_to_cart: 1,
  checkout: 2,
  escalated: 3,
  ordered: 4,
};

export interface TurnLog {
  id: string;
  tenantId: string | null;
  channel?: 'web' | 'whatsapp';
  mode?: 'storefront' | 'marketplace';
  model?: string;
  toolsUsed?: string[];
  waPhone?: string | null;
}

/**
 * Record one assistant turn. Upserts the session row, incrementing turn and
 * tool counters and merging the set of tools used.
 */
export async function logTurn(supabase: SupabaseClient, log: TurnLog): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('adepa_conversations')
      .select('turns, tool_calls, tools_used')
      .eq('id', log.id)
      .maybeSingle();

    const newTools = log.toolsUsed || [];
    const mergedTools = Array.from(
      new Set([...((existing?.tools_used as string[]) || []), ...newTools])
    );

    await supabase.from('adepa_conversations').upsert(
      {
        id: log.id,
        tenant_id: log.tenantId,
        channel: log.channel || 'web',
        mode: log.mode || 'marketplace',
        model: log.model || null,
        turns: (existing?.turns ?? 0) + 1,
        tool_calls: (existing?.tool_calls ?? 0) + newTools.length,
        tools_used: mergedTools,
        wa_phone: log.waPhone ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {
    // swallow — observability must never break the conversation
  }
}

/**
 * Move a session forward in the funnel. No-ops if the session is already at or
 * past the given outcome.
 */
export async function recordOutcome(
  supabase: SupabaseClient,
  id: string,
  outcome: AdepaOutcome,
  extra?: { orderNumber?: string; orderTotal?: number }
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('adepa_conversations')
      .select('outcome')
      .eq('id', id)
      .maybeSingle();

    // Only record against a session that exists (was created by a real turn).
    if (!existing) return;

    const current = (existing.outcome as AdepaOutcome) || 'browsing';
    if (OUTCOME_RANK[outcome] <= OUTCOME_RANK[current]) return;

    await supabase
      .from('adepa_conversations')
      .update({
        outcome,
        order_number: extra?.orderNumber ?? undefined,
        order_total: extra?.orderTotal ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch {
    // swallow
  }
}

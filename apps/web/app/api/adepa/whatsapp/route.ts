import { generateText, stepCountIs, type ModelMessage } from 'ai';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSystemPrompt } from '@/lib/adepa/system-prompt';
import { buildTools } from '@/lib/adepa/tools';
import { isAdepaEnabled, ADEPA_MODEL } from '@/lib/adepa/config';
import { rateLimit } from '@/lib/adepa/ratelimit';
import { logTurn } from '@/lib/adepa/analytics';
import { isWhatsAppConfigured, sendWhatsApp } from '@/lib/whatsapp/client';
import { verifyTwilioSignature, publicWebhookUrl } from '@/lib/whatsapp/verify';
import { normalizeGhanaPhone } from '@/lib/utils/phone';
import type { AdepaContext } from '@/lib/adepa/types';

const WEBHOOK_PATH = '/api/adepa/whatsapp';
const MAX_HISTORY = 10; // turns kept for continuity
const FALLBACK = "I'm here, but had trouble just now — please send that again.";

// Empty TwiML: we reply out-of-band via the REST API, so Twilio shouldn't.
function twiml() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

interface WaMsg {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  // Dormant until both the concierge and a WhatsApp provider are configured.
  if (!isAdepaEnabled() || !isWhatsAppConfigured()) return twiml();

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Authenticate the webhook (no-op if no auth token configured).
  const valid = verifyTwilioSignature(
    publicWebhookUrl(req, WEBHOOK_PATH),
    params,
    req.headers.get('x-twilio-signature')
  );
  if (!valid) return new Response('Forbidden', { status: 403 });

  const fromRaw = (params.From || '').replace(/^whatsapp:/, '').trim();
  const toRaw = (params.To || '').replace(/^whatsapp:/, '').trim();
  const bodyText = (params.Body || '').trim();
  if (!fromRaw || !bodyText) return twiml();

  const phone = normalizeGhanaPhone(fromRaw);

  // Per-sender throttle.
  if (!rateLimit(`wa:${phone}`, 20, 60_000).ok) {
    await sendWhatsApp({ to: phone, message: "One sec — too many messages. Try again shortly." });
    return twiml();
  }

  const supabase = createAdminClient();

  // Resolve which kitchen this number belongs to: explicit default slug, else
  // match the inbound "To" against a tenant's saved WhatsApp number.
  let tenant: { id: string; name: string; slug: string; adepa_local_voice: boolean } | null = null;
  const defaultSlug = process.env.ADEPA_WA_DEFAULT_TENANT_SLUG;
  if (defaultSlug) {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, slug, adepa_local_voice')
      .eq('slug', defaultSlug)
      .eq('status', 'active')
      .maybeSingle();
    tenant = data;
  }
  if (!tenant && toRaw) {
    const last9 = normalizeGhanaPhone(toRaw).slice(-9);
    const { data } = await supabase
      .from('tenants')
      .select('id, name, slug, adepa_local_voice')
      .ilike('whatsapp', `%${last9}%`)
      .eq('status', 'active')
      .maybeSingle();
    tenant = data;
  }

  // Load / start the rolling transcript for this (tenant, phone).
  const { data: session } = await supabase
    .from('adepa_wa_sessions')
    .select('id, conversation_id, history')
    .eq('tenant_id', tenant?.id ?? null)
    .eq('phone', phone)
    .maybeSingle();

  const conversationId: string = session?.conversation_id || crypto.randomUUID();
  const history: WaMsg[] = Array.isArray(session?.history) ? (session!.history as WaMsg[]) : [];

  const origin = publicWebhookUrl(req, '').replace(/\/$/, '');
  const ctx: AdepaContext = {
    mode: tenant ? 'storefront' : 'marketplace',
    channel: 'whatsapp',
    tenantName: tenant?.name,
    localVoice: Boolean(tenant?.adepa_local_voice),
    storefrontUrl: tenant ? `${origin}/${tenant.slug}` : origin,
  };

  const messages: ModelMessage[] = [
    ...history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: 'user', content: bodyText },
  ];

  let reply = FALLBACK;
  let toolsUsed: string[] = [];
  try {
    const result = await generateText({
      model: ADEPA_MODEL,
      system: buildSystemPrompt(ctx),
      messages,
      tools: buildTools(supabase, tenant?.id ?? null),
      stopWhen: stepCountIs(5),
    });
    if (result.text?.trim()) reply = result.text.trim();
    toolsUsed = result.steps.flatMap((s) => s.toolCalls ?? []).map((tc) => tc.toolName);
  } catch (err) {
    console.error('Adepa WhatsApp generation failed:', err);
  }

  await sendWhatsApp({ to: phone, message: reply });

  // Persist transcript (bounded) + analytics.
  const nextHistory = [
    ...history,
    { role: 'user', content: bodyText },
    { role: 'assistant', content: reply },
  ].slice(-MAX_HISTORY * 2);

  await supabase.from('adepa_wa_sessions').upsert(
    {
      id: session?.id,
      tenant_id: tenant?.id ?? null,
      phone,
      conversation_id: conversationId,
      history: nextHistory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,phone' }
  );

  await logTurn(supabase, {
    id: conversationId,
    tenantId: tenant?.id ?? null,
    channel: 'whatsapp',
    mode: ctx.mode,
    model: ADEPA_MODEL,
    toolsUsed,
    waPhone: phone,
  });

  return twiml();
}

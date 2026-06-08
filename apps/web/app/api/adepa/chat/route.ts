import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSystemPrompt } from '@/lib/adepa/system-prompt';
import { buildTools } from '@/lib/adepa/tools';
import { isAdepaEnabled, ADEPA_MODEL } from '@/lib/adepa/config';
import { rateLimit } from '@/lib/adepa/ratelimit';
import { logTurn } from '@/lib/adepa/analytics';
import type { AdepaContext } from '@/lib/adepa/types';
import { corsHeaders, preflight } from '@/lib/http/cors';

export async function POST(req: Request) {
  if (!isAdepaEnabled()) {
    return Response.json({ error: 'Fafa is not available yet.' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`ip:${ip}`, 60, 60_000).ok) {
    return Response.json(
      { error: "Let's slow down a touch — try again in a moment." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    context?: AdepaContext;
    tenantSlug?: string;
    conversationId?: string;
  };
  const supabase = createAdminClient();

  let tenantId: string | null = null;
  let ctx: AdepaContext = body.context || { mode: 'marketplace' };
  if (body.tenantSlug) {
    const { data: t } = await supabase
      .from('tenants')
      .select('id, name, adepa_local_voice')
      .eq('slug', body.tenantSlug)
      .eq('status', 'active')
      .maybeSingle();
    if (t) {
      tenantId = t.id;
      ctx = {
        ...ctx,
        mode: 'storefront',
        tenantName: t.name,
        localVoice: Boolean(t.adepa_local_voice),
      };
    }
  }

  const modelMessages = await convertToModelMessages(body.messages);
  const result = streamText({
    model: ADEPA_MODEL,
    system: buildSystemPrompt(ctx),
    messages: modelMessages,
    tools: buildTools(supabase, tenantId),
    stopWhen: stepCountIs(5),
    onFinish: ({ steps }) => {
      // Best-effort observability — never blocks or breaks the stream.
      if (!body.conversationId) return;
      const toolsUsed = steps
        .flatMap((s) => s.toolCalls ?? [])
        .map((tc) => tc.toolName);
      void logTurn(supabase, {
        id: body.conversationId,
        tenantId,
        channel: 'web',
        mode: ctx.mode,
        model: ADEPA_MODEL,
        toolsUsed,
      });
    },
  });

  const response = result.toUIMessageStreamResponse();
  const headers = corsHeaders(req.headers.get('origin'));
  Object.entries(headers).forEach(([k, v]) => {
    response.headers.set(k, v);
  });
  return response;
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

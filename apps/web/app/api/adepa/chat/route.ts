import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSystemPrompt } from '@/lib/adepa/system-prompt';
import { buildTools } from '@/lib/adepa/tools';
import { isAdepaEnabled, ADEPA_MODEL } from '@/lib/adepa/config';
import { rateLimit } from '@/lib/adepa/ratelimit';
import type { AdepaContext } from '@/lib/adepa/types';

export async function POST(req: Request) {
  if (!isAdepaEnabled()) {
    return Response.json({ error: 'Adepa is not available yet.' }, { status: 503 });
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
  };
  const supabase = createAdminClient();

  let tenantId: string | null = null;
  let ctx: AdepaContext = body.context || { mode: 'marketplace' };
  if (body.tenantSlug) {
    const { data: t } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', body.tenantSlug)
      .eq('status', 'active')
      .maybeSingle();
    if (t) {
      tenantId = t.id;
      ctx = { ...ctx, mode: 'storefront', tenantName: t.name };
    }
  }

  const modelMessages = await convertToModelMessages(body.messages);
  const result = streamText({
    model: ADEPA_MODEL,
    system: buildSystemPrompt(ctx),
    messages: modelMessages,
    tools: buildTools(supabase, tenantId),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}

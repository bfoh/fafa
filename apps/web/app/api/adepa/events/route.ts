import { createAdminClient } from '@/lib/supabase/admin';
import { isAdepaEnabled } from '@/lib/adepa/config';
import { recordOutcome, type AdepaOutcome } from '@/lib/adepa/analytics';

const ALLOWED: AdepaOutcome[] = ['added_to_cart', 'checkout', 'ordered', 'escalated'];

/**
 * Lightweight beacon from the widget / order-confirmation page to advance a
 * conversation's funnel outcome (the chat -> order conversion signal).
 */
export async function POST(req: Request) {
  if (!isAdepaEnabled()) {
    return Response.json({ ok: false }, { status: 503 });
  }

  let body: {
    conversationId?: string;
    type?: AdepaOutcome;
    orderNumber?: string;
    orderTotal?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!body.conversationId || !body.type || !ALLOWED.includes(body.type)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const supabase = createAdminClient();
  await recordOutcome(supabase, body.conversationId, body.type, {
    orderNumber: body.orderNumber,
    orderTotal:
      typeof body.orderTotal === 'number' ? body.orderTotal : undefined,
  });

  return Response.json({ ok: true });
}

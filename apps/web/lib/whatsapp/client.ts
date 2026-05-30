/**
 * WhatsApp Business messaging (transactional notifications).
 *
 * Provider-agnostic with a Twilio implementation. Returns
 * `{ skipped: true }` when no provider is configured, so callers can
 * wire it in safely before credentials exist — flip it on later by
 * setting the env vars below (no code change).
 *
 * Twilio env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   e.g. "+14155238886" (Twilio WhatsApp sender)
 */

import { normalizeGhanaPhone } from '@/lib/utils/phone';

export type WhatsAppProvider = 'twilio';

export interface WhatsAppResult {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  provider?: WhatsAppProvider;
}

/** Whether any WhatsApp provider is configured. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

async function sendViaTwilio(to: string, message: string): Promise<WhatsAppResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;

  const body = new URLSearchParams({
    From: `whatsapp:${from.startsWith('+') ? from : `+${from}`}`,
    To: `whatsapp:${normalizeGhanaPhone(to)}`,
    Body: message,
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.message || `Twilio error ${res.status}`, provider: 'twilio' };
    }
    return { success: true, messageId: data?.sid, provider: 'twilio' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error', provider: 'twilio' };
  }
}

/** Send a WhatsApp message. No-ops (skipped) when unconfigured. */
export async function sendWhatsApp({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) return { success: false, skipped: true };
  return sendViaTwilio(to, message);
}

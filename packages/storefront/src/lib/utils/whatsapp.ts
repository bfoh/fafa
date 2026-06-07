/**
 * WhatsApp click-to-chat helpers.
 * Builds wa.me deep links — no API, works everywhere.
 */

import { normalizeGhanaPhone } from './phone';

/** wa.me wants the number as country-code digits with no '+' or spaces. */
export function waNumber(phone: string): string {
  return normalizeGhanaPhone(phone).replace(/[^\d]/g, '');
}

/**
 * Build a wa.me link. With a number → opens a chat with that number;
 * without → opens the share sheet. `text` is pre-filled message body.
 */
export function waLink(phone: string | null | undefined, text?: string): string {
  const params = text ? `?text=${encodeURIComponent(text)}` : '';
  const num = phone ? waNumber(phone) : '';
  return num ? `https://wa.me/${num}${params}` : `https://wa.me/${params}`;
}

/** Share any URL to WhatsApp (opens contact picker). */
export function waShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

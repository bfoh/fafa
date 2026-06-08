'use client';

import type { AdepaOutcome } from '@fafa/types';

/**
 * Device-local conversation identity + chat->order attribution for Adepa.
 * The conversation id lives in sessionStorage (one per tab session); the
 * attribution token is stashed in localStorage at checkout hand-off so the
 * order-confirmation page (a different route) can close the loop.
 */

const CONV_KEY = 'didi_adepa_conv';
const ATTR_KEY = (slug: string) => `didi_adepa_attr_${slug}`;

export function getConversationId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(CONV_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(CONV_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function setAttribution(slug: string, conversationId: string) {
  try {
    if (conversationId) localStorage.setItem(ATTR_KEY(slug), conversationId);
  } catch {
    /* ignore */
  }
}

/** Read and clear the attribution token for a slug (single-use). */
export function takeAttribution(slug: string): string | null {
  try {
    const v = localStorage.getItem(ATTR_KEY(slug));
    if (v) localStorage.removeItem(ATTR_KEY(slug));
    return v;
  } catch {
    return null;
  }
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const isCapacitor =
    window.location.origin.startsWith('capacitor://') ||
    (window.location.origin.startsWith('https://localhost') && !window.location.port) ||
    window.location.href.includes('capacitor://');
  if (isCapacitor) {
    return process.env.NEXT_PUBLIC_API_BASE || 'https://ghdidi.com';
  }
  return '';
}

/** Fire-and-forget funnel beacon. */
export function pingOutcome(
  conversationId: string,
  type: AdepaOutcome,
  extra?: { orderNumber?: string; orderTotal?: number }
) {
  if (!conversationId) return;
  try {
    const baseUrl = getApiBaseUrl();
    void fetch(`${baseUrl}/api/adepa/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, type, ...extra }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

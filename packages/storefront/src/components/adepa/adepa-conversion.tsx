'use client';

import { useEffect } from 'react';
import { takeAttribution, pingOutcome } from '../../lib/adepa/session';

/**
 * Closes the chat -> order loop. If this device handed off to checkout from
 * Adepa, an attribution token was stashed; on the confirmation page we spend it
 * once to mark the conversation "ordered". Renders nothing.
 */
export function AdepaConversion({
  slug,
  orderNumber,
  total,
}: {
  slug: string;
  orderNumber: string;
  total: number;
}) {
  useEffect(() => {
    const conversationId = takeAttribution(slug);
    if (conversationId) {
      pingOutcome(conversationId, 'ordered', { orderNumber, orderTotal: total });
    }
  }, [slug, orderNumber, total]);

  return null;
}

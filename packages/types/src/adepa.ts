/**
 * Adepa (AI concierge) conversation funnel outcome. Shared by the client
 * session/attribution helpers and the server-side analytics writer, so the
 * funnel stages can never diverge between the two.
 */
export type AdepaOutcome =
  | 'browsing'
  | 'added_to_cart'
  | 'checkout'
  | 'ordered'
  | 'escalated';

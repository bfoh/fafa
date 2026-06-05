export const ADEPA_MODEL = process.env.ADEPA_MODEL || 'anthropic/claude-haiku-4-5';
export const ADEPA_MAX_TURNS = Number(process.env.ADEPA_MAX_TURNS_PER_SESSION || 30);

// Adepa is dormant until an AI gateway key is configured (mirrors the menu-photo feature).
export function isAdepaEnabled(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
}

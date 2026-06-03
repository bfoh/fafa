// Resolve the authoritative per-unit base price for an order line.
//
// Normal items: always the DB price (client price is never trusted).
// Chop-bar items: the customer builds a custom price client-side, so the client
// price is used — but floored at the configured DB base so a missing/omitted or
// tampered price can never charge below the restaurant's set minimum (and never
// silently collapses to 0, which previously undercharged orders).

export function resolveItemBasePrice(args: {
  isChopBar: boolean;
  clientPrice: number | null | undefined;
  dbPrice: number;
}): number {
  const db = Number(args.dbPrice) || 0;
  if (!args.isChopBar) return db;
  const client = Number(args.clientPrice) || 0;
  return Math.max(client, db);
}

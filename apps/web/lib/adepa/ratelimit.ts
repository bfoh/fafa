const hits = new Map<string, number[]>();

export function __resetRateLimit() {
  hits.clear();
}

// Sliding-window counter. Returns { ok, remaining }. `now` is injectable for tests.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; remaining: number } {
  const cutoff = now - windowMs;
  const arr = (hits.get(key) || []).filter((t) => t > cutoff);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, remaining: 0 };
  }
  arr.push(now);
  hits.set(key, arr);
  return { ok: true, remaining: limit - arr.length };
}

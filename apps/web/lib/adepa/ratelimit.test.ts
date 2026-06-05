import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimit } from './ratelimit';

describe('rateLimit', () => {
  beforeEach(() => __resetRateLimit());

  it('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) expect(rateLimit('a', 5, 1000).ok).toBe(true);
  });

  it('blocks the request over the limit', () => {
    for (let i = 0; i < 5; i++) rateLimit('a', 5, 1000);
    expect(rateLimit('a', 5, 1000).ok).toBe(false);
  });

  it('isolates different keys', () => {
    for (let i = 0; i < 5; i++) rateLimit('a', 5, 1000);
    expect(rateLimit('b', 5, 1000).ok).toBe(true);
  });

  it('resets after the window', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) rateLimit('a', 5, 1000, now);
    expect(rateLimit('a', 5, 1000, now).ok).toBe(false);
    expect(rateLimit('a', 5, 1000, now + 1001).ok).toBe(true);
  });
});

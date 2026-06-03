import { describe, it, expect } from 'vitest';
import { isPaidOrder } from './revenue';

describe('isPaidOrder', () => {
  it('counts an order whose payment is settled', () => {
    expect(isPaidOrder({ payment_status: 'paid' })).toBe(true);
  });

  it('does not count a pending payment', () => {
    expect(isPaidOrder({ payment_status: 'pending' })).toBe(false);
  });

  it('does not count a failed payment', () => {
    expect(isPaidOrder({ payment_status: 'failed' })).toBe(false);
  });

  it('does not count a missing payment status', () => {
    expect(isPaidOrder({})).toBe(false);
    expect(isPaidOrder({ payment_status: null })).toBe(false);
  });
});

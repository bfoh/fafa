import { describe, it, expect } from 'vitest';
import { isVisibleToRestaurant, VISIBLE_ORDER_FILTER } from './visibility';

describe('isVisibleToRestaurant', () => {
  it('shows a paid online order', () => {
    expect(isVisibleToRestaurant({ payment_status: 'paid', payment_method: 'momo' })).toBe(true);
  });

  it('hides an unpaid online order', () => {
    expect(isVisibleToRestaurant({ payment_status: 'pending', payment_method: 'momo' })).toBe(false);
    expect(isVisibleToRestaurant({ payment_status: 'failed', payment_method: 'card' })).toBe(false);
  });

  it('always shows a cash-on-delivery order, even while unpaid', () => {
    expect(isVisibleToRestaurant({ payment_status: 'pending', payment_method: 'cash_on_delivery' })).toBe(true);
  });

  it('exposes a matching PostgREST .or() filter string', () => {
    expect(VISIBLE_ORDER_FILTER).toBe('payment_status.eq.paid,payment_method.eq.cash_on_delivery');
  });
});

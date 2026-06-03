import { describe, it, expect } from 'vitest';
import { resolveItemBasePrice } from './item-pricing';

describe('resolveItemBasePrice', () => {
  it('uses the DB price for normal items, ignoring any client price', () => {
    expect(resolveItemBasePrice({ isChopBar: false, clientPrice: 1, dbPrice: 30 })).toBe(30);
  });

  it('uses the customer-built price for chop-bar items when above the base', () => {
    expect(resolveItemBasePrice({ isChopBar: true, clientPrice: 40, dbPrice: 25 })).toBe(40);
  });

  it('never drops chop-bar base to 0 when the client omits the price (the bug)', () => {
    // Regression: checkout previously did not send `price`, zeroing chop-bar base.
    expect(resolveItemBasePrice({ isChopBar: true, clientPrice: undefined, dbPrice: 25 })).toBe(25);
  });

  it('floors a tampered/low chop-bar price at the configured base', () => {
    expect(resolveItemBasePrice({ isChopBar: true, clientPrice: 5, dbPrice: 25 })).toBe(25);
  });

  it('uses the client chop-bar price when the configured base is 0', () => {
    expect(resolveItemBasePrice({ isChopBar: true, clientPrice: 20, dbPrice: 0 })).toBe(20);
  });
});

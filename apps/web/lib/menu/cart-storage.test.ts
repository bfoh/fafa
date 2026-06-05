import { describe, it, expect } from 'vitest';
import { mergeCart } from './cart-storage';
import type { CartItem } from '@/hooks/use-cart';

const item = (menuItemId: string, quantity = 1): CartItem => ({
  menuItemId,
  name: menuItemId,
  price: 10,
  quantity,
  options: [],
  imageUrl: null,
});

describe('mergeCart', () => {
  it('appends a new item', () => {
    expect(mergeCart([], item('a')).length).toBe(1);
  });

  it('increments quantity for an existing item', () => {
    const out = mergeCart([item('a', 1)], item('a', 2));
    expect(out.length).toBe(1);
    expect(out[0].quantity).toBe(3);
  });

  it('keeps distinct items separate', () => {
    const out = mergeCart([item('a')], item('b'));
    expect(out.map((i) => i.menuItemId)).toEqual(['a', 'b']);
  });
});

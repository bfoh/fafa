import { describe, it, expect } from 'vitest';
import { parseMenuList } from './parse-list';

describe('parseMenuList', () => {
  it('parses a dish with a trailing price', () => {
    expect(parseMenuList('Jollof Rice 45')).toEqual([
      { category: null, items: [{ name: 'Jollof Rice', price: 45 }] },
    ]);
  });

  it('treats a line with no price as a category header', () => {
    const out = parseMenuList('Drinks\nSobolo 10\nWater 5');
    expect(out).toEqual([
      { category: 'Drinks', items: [{ name: 'Sobolo', price: 10 }, { name: 'Water', price: 5 }] },
    ]);
  });

  it('supports multiple sections', () => {
    const out = parseMenuList('DRINKS\nSobolo 10\nMAINS\nJollof 45');
    expect(out.map((s) => s.category)).toEqual(['Drinks', 'Mains']);
    expect(out[1].items).toEqual([{ name: 'Jollof', price: 45 }]);
  });

  it('handles GHS / cedi / decimal price formats', () => {
    expect(parseMenuList('Banku GHS 50')[0].items[0]).toEqual({ name: 'Banku', price: 50 });
    expect(parseMenuList('Kelewele ₵15.50')[0].items[0]).toEqual({ name: 'Kelewele', price: 15.5 });
    expect(parseMenuList('Water 5 cedis')[0].items[0]).toEqual({ name: 'Water', price: 5 });
  });

  it('extracts a description after a dash or colon', () => {
    expect(parseMenuList('Jollof - smoky party rice 45')[0].items[0]).toEqual({
      name: 'Jollof', price: 45, description: 'smoky party rice',
    });
  });

  it('puts items before any header into the default category', () => {
    expect(parseMenuList('Jollof 45', 'Main Dishes')).toEqual([
      { category: 'Main Dishes', items: [{ name: 'Jollof', price: 45 }] },
    ]);
  });

  it('flags a chop-bar item tagged (chop bar) and strips the tag', () => {
    expect(parseMenuList('Assorted Rice (chop bar) 20')[0].items[0]).toEqual({
      name: 'Assorted Rice', price: 20, chopBar: true,
    });
  });

  it('skips blank and nameless lines', () => {
    const out = parseMenuList('\n  \nJollof 45\n   99');
    expect(out).toEqual([{ category: null, items: [{ name: 'Jollof', price: 45 }] }]);
  });
});

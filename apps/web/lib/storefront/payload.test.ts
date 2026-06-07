import { describe, it, expect } from 'vitest';
import { shapeMenuCategories } from './payload';

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'i',
  name: 'Item',
  price: 10,
  is_available: true,
  sort_order: 0,
  menu_item_options: [],
  ...over,
});

describe('shapeMenuCategories', () => {
  it('returns [] for null/undefined/empty input', () => {
    expect(shapeMenuCategories(null)).toEqual([]);
    expect(shapeMenuCategories(undefined)).toEqual([]);
    expect(shapeMenuCategories([])).toEqual([]);
  });

  it('drops unavailable items', () => {
    const out = shapeMenuCategories([
      {
        id: 'c1',
        name: 'Mains',
        sort_order: 0,
        menu_items: [
          item({ id: 'a', is_available: true }),
          item({ id: 'b', is_available: false }),
        ],
      },
    ]);
    expect(out[0].menu_items.map((i) => i.id)).toEqual(['a']);
  });

  it('sorts items by sort_order', () => {
    const out = shapeMenuCategories([
      {
        id: 'c1',
        name: 'Mains',
        sort_order: 0,
        menu_items: [
          item({ id: 'a', sort_order: 2 }),
          item({ id: 'b', sort_order: 0 }),
          item({ id: 'c', sort_order: 1 }),
        ],
      },
    ]);
    expect(out[0].menu_items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('drops categories left empty after filtering', () => {
    const out = shapeMenuCategories([
      {
        id: 'empty',
        name: 'All sold out',
        sort_order: 0,
        menu_items: [item({ is_available: false })],
      },
      {
        id: 'keep',
        name: 'Available',
        sort_order: 1,
        menu_items: [item({ id: 'x', is_available: true })],
      },
    ]);
    expect(out.map((c) => c.id)).toEqual(['keep']);
  });

  it('handles categories with no menu_items field', () => {
    const out = shapeMenuCategories([{ id: 'c', name: 'X', sort_order: 0 }]);
    expect(out).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { matchChopBarOptions, type ChopBarItem } from './chopbar';

const item: ChopBarItem = {
  id: 'bowl-1',
  name: 'Chop Bar Bowl',
  price: 20,
  menu_item_options: [
    { id: 'soup-1', name: 'Light Soup', option_type: 'soup', price_modifier: 0 },
    { id: 'soup-2', name: 'Groundnut Soup', option_type: 'soup', price_modifier: 0 },
    { id: 'prot-1', name: 'Tilapia', option_type: 'protein', price_modifier: 0,
      price_tiers: [ { label: 'S', price: 60 }, { label: 'M', price: 80 }, { label: 'L', price: 120 } ] },
    { id: 'prot-2', name: 'Chicken', option_type: 'protein', price_modifier: 25 },
    { id: 'extra-1', name: 'Shito', option_type: 'extra', price_modifier: 5 },
    { id: 'extra-2', name: 'Pepper', option_type: 'extra', price_modifier: 3 },
    { id: 'extra-3', name: 'Sides', option_type: 'extra', price_modifier: 0, sub_options: 'Banku, Fufu, Rice', min_quantity: 10 },
  ],
};

describe('matchChopBarOptions', () => {
  it('selects named options and totals their prices', () => {
    const b = matchChopBarOptions(item, 'banku with tilapia and extra pepper');
    const names = b.selected.map((s) => s.name);
    expect(names).toContain('Sides'); // matched via "banku" sub-option
    expect(names).toContain('Tilapia');
    expect(names).toContain('Pepper');
    // base 20 + tilapia default tier 60 + pepper 3 + sides min_qty 10 = 93
    expect(b.total).toBe(93);
  });

  it('honours negation — "no shito" excludes it', () => {
    const b = matchChopBarOptions(item, 'chicken, no shito');
    const names = b.selected.map((s) => s.name);
    expect(names).toContain('Chicken');
    expect(names).not.toContain('Shito');
  });

  it('picks the large price tier when asked for big', () => {
    const b = matchChopBarOptions(item, 'big tilapia');
    const tilapia = b.selected.find((s) => s.name === 'Tilapia');
    expect(tilapia?.priceModifier).toBe(120);
  });

  it('picks the small tier for small', () => {
    const b = matchChopBarOptions(item, 'small tilapia please');
    expect(b.selected.find((s) => s.name === 'Tilapia')?.priceModifier).toBe(60);
  });

  it('reports unmatched requests instead of dropping them silently', () => {
    const b = matchChopBarOptions(item, 'tilapia and kelewele');
    expect(b.unmatched).toContain('kelewele');
  });

  it('returns just the base bowl when nothing matches', () => {
    const b = matchChopBarOptions(item, 'something nice');
    expect(b.selected).toHaveLength(0);
    expect(b.total).toBe(20);
  });
});

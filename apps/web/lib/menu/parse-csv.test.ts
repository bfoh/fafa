import { describe, it, expect } from 'vitest';
import { parseMenuCsv, MENU_CSV_TEMPLATE } from './parse-csv';

describe('parseMenuCsv', () => {
  it('parses name,price,category,description with a header row', () => {
    const csv = 'name,price,category,description\nJollof,45,Mains,Smoky rice\nWater,5,Drinks,';
    expect(parseMenuCsv(csv)).toEqual([
      { name: 'Jollof', price: 45, category: 'Mains', description: 'Smoky rice' },
      { name: 'Water', price: 5, category: 'Drinks' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,price,category\n"Rice, beans & egg",35,Mains';
    expect(parseMenuCsv(csv)[0]).toEqual({ name: 'Rice, beans & egg', price: 35, category: 'Mains' });
  });

  it('skips rows with no name or bad price', () => {
    const csv = 'name,price\n,10\nJollof,abc\nWaakye,35';
    expect(parseMenuCsv(csv)).toEqual([{ name: 'Waakye', price: 35, category: '' }]);
  });

  it('exposes a template string', () => {
    expect(MENU_CSV_TEMPLATE.split('\n')[0]).toBe('name,price,category,description');
  });
});

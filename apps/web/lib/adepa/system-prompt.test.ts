import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  it('names the tenant on a storefront', () => {
    const p = buildSystemPrompt({ mode: 'storefront', tenantName: "Auntie Maa's", tenantOpen: true });
    expect(p).toContain("Auntie Maa's");
    expect(p).toContain('open');
  });

  it('greets a returning customer with the usual', () => {
    const p = buildSystemPrompt({ mode: 'storefront', tenantName: 'X', customerFirstName: 'Kofi', usual: 'Waakye Special' });
    expect(p).toContain('Kofi');
    expect(p).toContain('Waakye Special');
  });

  it('omits the usual when there is no last order', () => {
    const p = buildSystemPrompt({ mode: 'storefront', tenantName: 'X', customerFirstName: 'Kofi' });
    expect(p).not.toContain('the usual');
  });

  it('always forbids inventing prices', () => {
    const p = buildSystemPrompt({ mode: 'marketplace' });
    expect(p.toLowerCase()).toContain('never invent');
    expect(p).toContain('GH₵');
  });
});

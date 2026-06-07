import { describe, it, expect } from 'vitest';
import { corsHeaders } from './cors';

describe('corsHeaders', () => {
  it('reflects allowed Capacitor origins', () => {
    for (const origin of [
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
      'https://www.ghdidi.com',
      'https://ghdidi.com',
    ]) {
      expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
    }
  });

  it('reflects localhost / 127.0.0.1 on any port (dev + local preview)', () => {
    for (const origin of [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:5500',
      'https://localhost:3000',
    ]) {
      expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
    }
  });

  it('falls back to the canonical origin for disallowed origins', () => {
    for (const origin of [
      'https://evil.example.com',
      'http://localhost.evil.com', // not a real localhost
      'https://notlocalhost',
    ]) {
      expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(
        'https://www.ghdidi.com'
      );
    }
  });

  it('falls back when origin is null (non-browser / same-origin)', () => {
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBe(
      'https://www.ghdidi.com'
    );
  });

  it('always varies on Origin and allows the needed methods', () => {
    const h = corsHeaders('capacitor://localhost');
    expect(h['Vary']).toBe('Origin');
    expect(h['Access-Control-Allow-Methods']).toContain('GET');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

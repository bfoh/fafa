import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateKeyPairSync, createVerify } from 'crypto';

// Real EC P-256 key so the signature is verifiable.
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

describe('apns', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('isApnsConfigured false without env', async () => {
    const { isApnsConfigured } = await import('./apns');
    expect(isApnsConfigured()).toBe(false);
  });

  it('isApnsConfigured true with full env', async () => {
    vi.stubEnv('APNS_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APNS_KEY_ID', 'KEY1234567');
    vi.stubEnv('APNS_PRIVATE_KEY', pem);
    const { isApnsConfigured } = await import('./apns');
    expect(isApnsConfigured()).toBe(true);
  });

  it('builds a valid ES256 JWT (header kid, claims iss/iat, verifiable signature)', async () => {
    vi.stubEnv('APNS_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APNS_KEY_ID', 'KEY1234567');
    vi.stubEnv('APNS_PRIVATE_KEY', pem);
    const { apnsJwtForTesting } = await import('./apns');
    const jwt = apnsJwtForTesting();
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'KEY1234567',
    });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims.iss).toBe('TEAM123456');
    expect(typeof claims.iat).toBe('number');
    const verify = createVerify('SHA256').update(`${h}.${c}`);
    expect(
      verify.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))
    ).toBe(true);
  });
});

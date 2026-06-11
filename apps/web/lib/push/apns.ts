import crypto from 'crypto';
import http2 from 'http2';

/**
 * Direct APNs HTTP/2 client for Live Activity updates. FCM cannot deliver
 * `liveactivity` pushes, so this talks to Apple directly. Env-gated like
 * lib/push/fcm.ts — with no key configured every caller is a no-op.
 *
 * Env:
 *   APNS_TEAM_ID      Apple Developer team id
 *   APNS_KEY_ID       APNs auth key id (from the .p8 download page)
 *   APNS_PRIVATE_KEY  .p8 contents (\n-escaped is fine)
 *   APNS_ENV          'production' (default; TestFlight uses production) | 'sandbox'
 */

const TEAM_ID = process.env.APNS_TEAM_ID;
const KEY_ID = process.env.APNS_KEY_ID;
const PRIVATE_KEY = process.env.APNS_PRIVATE_KEY
  ?.replace(/^["']|["']$/g, '')
  ?.replace(/\\n/g, '\n')
  ?.trim();
const BUNDLE_ID = 'com.ghdidi.app';
const HOST =
  process.env.APNS_ENV === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';

export function isApnsConfigured(): boolean {
  return !!(TEAM_ID && KEY_ID && PRIVATE_KEY);
}

// ── ES256 provider JWT (cached ~50 min; Apple allows 20–60) ──
let cachedJwt: { value: string; iat: number } | null = null;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function apnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.iat < 3000) return cachedJwt.value;

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signature = crypto
    .createSign('SHA256')
    .update(`${header}.${claims}`)
    .sign({ key: PRIVATE_KEY as string, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  const jwt = `${header}.${claims}.${signature}`;
  cachedJwt = { value: jwt, iat: now };
  return jwt;
}

/** Test-only export: JWT building without sending. */
export function apnsJwtForTesting(): string {
  return apnsJwt();
}

export interface LiveActivityPush {
  event: 'update' | 'end';
  contentState: Record<string, unknown>;
  /** 10 = deliver now (status changes, arrival); 5 = opportunistic (bar movement). */
  priority?: 5 | 10;
}

export type ApnsSendResult = 'ok' | 'stale' | 'error';

/** Single-shot HTTP/2 POST. APNs requires HTTP/2; fetch() can't do it. */
function http2Post(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { origin, pathname } = new URL(url);
    const client = http2.connect(origin);
    client.on('error', reject);
    const req = client.request({
      ':method': 'POST',
      ':path': pathname,
      ...headers,
    });
    let data = '';
    let status = 0;
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      client.close();
      resolve({ status, body: data });
    });
    req.on('error', (err) => {
      client.close();
      reject(err);
    });
    req.end(body);
  });
}

export async function sendLiveActivityPush(
  token: string,
  push: LiveActivityPush
): Promise<ApnsSendResult> {
  if (!isApnsConfigured()) return 'error';
  try {
    const payload = JSON.stringify({
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: push.event,
        'content-state': push.contentState,
      },
    });
    const { status, body } = await http2Post(
      `${HOST}/3/device/${token}`,
      {
        authorization: `bearer ${apnsJwt()}`,
        'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
        'apns-push-type': 'liveactivity',
        'apns-priority': String(push.priority ?? 10),
        'content-type': 'application/json',
      },
      payload
    );

    if (status === 200) return 'ok';
    if (status === 410 || body.includes('BadDeviceToken') || body.includes('Unregistered')) {
      return 'stale';
    }
    console.error(`APNs live activity push ${status}: ${body}`);
    return 'error';
  } catch (err) {
    console.error('APNs live activity push failed:', err);
    return 'error';
  }
}

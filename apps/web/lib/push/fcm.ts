import crypto from 'crypto';

/**
 * Firebase Cloud Messaging HTTP v1 sender. Fully env-gated: with no service
 * account configured, isPushConfigured() is false and every caller is a no-op,
 * so this is inert in production until credentials are added (legacy FCM server
 * keys are shut down; v1 + OAuth is the only path).
 *
 * Env (service account):
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY  (\n-escaped is fine)
 */

const PROJECT_ID = process.env.FCM_PROJECT_ID;
const CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');

export function isPushConfigured(): boolean {
  return !!(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY);
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ── OAuth access token (cached until ~1 min before expiry) ──
let cachedToken: { value: string; exp: number } | null = null;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(PRIVATE_KEY as string)
    .toString('base64url');
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM token exchange ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

/**
 * Send one message to many tokens (one request each — FCM v1 has no multicast
 * endpoint). Best-effort: failures are swallowed; 404/410 tokens are pruned.
 * Returns the count delivered without an error status.
 */
export async function sendPush(
  tokens: string[],
  message: PushMessage
): Promise<number> {
  if (!isPushConfigured() || tokens.length === 0) return 0;

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('FCM auth failed:', err);
    return 0;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
  const stale: string[] = [];

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'high' },
          },
        }),
      });
      if (res.status === 404 || res.status === 410) {
        stale.push(token);
        throw new Error('stale token');
      }
      if (!res.ok) throw new Error(`FCM send ${res.status}`);
    })
  );

  if (stale.length) await pruneStaleTokens(stale);
  return results.filter((r) => r.status === 'fulfilled').length;
}

// Imported lazily to avoid a server/admin dep at module load in non-push paths.
async function pruneStaleTokens(tokens: string[]): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    await createAdminClient().from('device_tokens').delete().in('token', tokens);
  } catch (err) {
    console.error('prune stale tokens failed:', err);
  }
}

import crypto from 'crypto';

/**
 * Validate a Twilio inbound webhook signature.
 *
 * Twilio signs the request as: HMAC-SHA1(authToken, fullUrl + sortedParamsConcat)
 * base64-encoded, sent in the `X-Twilio-Signature` header. `fullUrl` must match
 * the exact public URL Twilio called (scheme + host + path + query).
 *
 * Returns true when valid, or when no auth token is configured (so the channel
 * still works in local/sandbox testing — production sets the token).
 */
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // unconfigured → don't block (dev/sandbox)
  if (!signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const key of sortedKeys) data += key + params[key];

  const expected = crypto
    .createHmac('sha1', token)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Reconstruct the public URL Twilio used, honouring proxy headers / override. */
export function publicWebhookUrl(req: Request, path: string): string {
  const override = process.env.ADEPA_WA_PUBLIC_URL;
  if (override) return override.replace(/\/$/, '') + path;
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  return `${proto}://${host}${path}`;
}

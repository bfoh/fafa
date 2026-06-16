/**
 * CORS for the mobile (Capacitor) client. The static bundle is served from an
 * embedded localhost scheme, so cross-origin requests to these API routes carry
 * one of the origins below. Web SSR pages never hit CORS (same origin), so this
 * is additive and cannot affect the live web app.
 *
 *   iOS WebView     → capacitor://localhost
 *   Android WebView → https://localhost  (androidScheme: 'https')
 *   Web / fallback  → https://www.ghdidi.com
 */
const ALLOWED = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'https://www.ghdidi.com',
  'https://ghdidi.com',
]);

// Any localhost / 127.0.0.1 port — for `next dev` and local static previews of
// the mobile bundle. Safe: a remote attacker's page can never have a localhost
// origin, so reflecting it grants no cross-site access on a victim's browser.
const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowed(origin: string): boolean {
  return ALLOWED.has(origin) || LOCAL_DEV.test(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && isAllowed(origin) ? origin : 'https://www.ghdidi.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

/** Preflight response for OPTIONS handlers. */
export function preflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

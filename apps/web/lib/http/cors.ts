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
  'http://localhost', // local `next dev` of apps/mobile
  'https://www.ghdidi.com',
  'https://ghdidi.com',
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.has(origin) ? origin : 'https://www.ghdidi.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/**
 * Maps push-notification data to the customer order-tracker route. Order
 * pushes (lib/notifications/push.ts) carry { orderId, slug }; the tracker
 * lives at /[slug]/order/[orderId] on the storefront. Returns null when
 * either key is missing — there is no slug-less tracker to fall back to.
 */
export function orderTrackingUrl(
  data: { orderId?: string; slug?: string } | undefined
): string | null {
  if (!data?.orderId || !data.slug) return null;
  return `/${encodeURIComponent(data.slug)}/order/${encodeURIComponent(data.orderId)}`;
}

/**
 * Maps a tracker universal link (Live Activity widget tap) to an in-app path:
 * https://ghdidi.com/<slug>/order/<orderId> → /<slug>/order/<orderId>.
 * Returns null for anything else.
 */
export function trackerPathFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts.length === 3 && parts[1] === 'order') {
      return `/${parts[0]}/order/${parts[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}

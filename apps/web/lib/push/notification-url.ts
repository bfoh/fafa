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

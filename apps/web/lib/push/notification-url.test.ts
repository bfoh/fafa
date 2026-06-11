import { describe, it, expect } from 'vitest';
import { orderTrackingUrl } from './notification-url';

describe('orderTrackingUrl', () => {
  it('maps orderId + slug to the storefront tracker route', () => {
    expect(orderTrackingUrl({ orderId: 'abc-123', slug: 'mama-chops' })).toBe(
      '/mama-chops/order/abc-123'
    );
  });

  it('returns null when slug is missing (no storefront to route to)', () => {
    expect(orderTrackingUrl({ orderId: 'abc-123' })).toBeNull();
  });

  it('returns null when orderId is missing', () => {
    expect(orderTrackingUrl({ slug: 'mama-chops' })).toBeNull();
  });

  it('returns null for undefined data', () => {
    expect(orderTrackingUrl(undefined)).toBeNull();
  });

  it('encodes path segments', () => {
    expect(orderTrackingUrl({ orderId: 'a/b', slug: 's p' })).toBe(
      '/s%20p/order/a%2Fb'
    );
  });
});

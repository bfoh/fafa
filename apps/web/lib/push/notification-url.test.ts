import { describe, it, expect } from 'vitest';
import { orderTrackingUrl, pushTargetUrl, trackerPathFromUrl } from './notification-url';

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

describe('pushTargetUrl', () => {
  it('prefers an explicit in-app path (owner pushes)', () => {
    expect(pushTargetUrl({ path: '/orders' })).toBe('/orders');
  });

  it('falls back to the order tracker mapping', () => {
    expect(pushTargetUrl({ orderId: 'abc', slug: 'mama-chops' })).toBe('/mama-chops/order/abc');
  });

  it('rejects non-relative and protocol-relative paths', () => {
    expect(pushTargetUrl({ path: 'https://evil.example' })).toBeNull();
    expect(pushTargetUrl({ path: '//evil.example' })).toBeNull();
  });

  it('returns null for undefined data', () => {
    expect(pushTargetUrl(undefined)).toBeNull();
  });
});

describe('trackerPathFromUrl', () => {
  it('maps a tracker universal link to its path', () => {
    expect(trackerPathFromUrl('https://ghdidi.com/mama-chops/order/abc-123')).toBe(
      '/mama-chops/order/abc-123'
    );
  });

  it('returns null for non-tracker links', () => {
    expect(trackerPathFromUrl('https://ghdidi.com/mama-chops')).toBeNull();
    expect(trackerPathFromUrl('https://ghdidi.com/')).toBeNull();
    expect(trackerPathFromUrl('not a url')).toBeNull();
  });
});

'use client';

import type { CartItem } from '../../hooks/use-cart';

/**
 * Lightweight, device-local customer memory — no accounts, no server
 * phone lookup (which would leak others' order history). Stores the
 * customer's own details for checkout prefill and a snapshot of their
 * last order per restaurant for one-tap reorder.
 */

const CUSTOMER_KEY = 'didi_customer';
const LAST_ORDER_KEY = (slug: string) => `didi_last_order_${slug}`;

export interface SavedCustomer {
  name: string;
  phone: string;
  address?: string;
}

export interface LastOrder {
  orderNumber: string;
  items: CartItem[];
  savedAt: number;
}

export function saveCustomer(c: SavedCustomer) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota/availability */
  }
}

export function loadCustomer(): SavedCustomer | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? (JSON.parse(raw) as SavedCustomer) : null;
  } catch {
    return null;
  }
}

export function saveLastOrder(slug: string, orderNumber: string, items: CartItem[]) {
  try {
    if (!items.length) return;
    const payload: LastOrder = { orderNumber, items, savedAt: Date.now() };
    localStorage.setItem(LAST_ORDER_KEY(slug), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadLastOrder(slug: string): LastOrder | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY(slug));
    return raw ? (JSON.parse(raw) as LastOrder) : null;
  } catch {
    return null;
  }
}

const RECENT_ORDERS_KEY = 'didi_recent_orders';

export interface RecentOrder {
  slug: string;
  orderId: string;
  orderNumber: string;
  savedAt: number;
}

/** Append an order to the device-local recent list (dedup by id, newest first, capped at 10). */
export function saveRecentOrder(slug: string, orderId: string, orderNumber: string) {
  try {
    const list = loadRecentOrders().filter((o) => o.orderId !== orderId);
    list.unshift({ slug, orderId, orderNumber, savedAt: Date.now() });
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore quota/availability */
  }
}

export function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = localStorage.getItem(RECENT_ORDERS_KEY);
    const list = raw ? (JSON.parse(raw) as RecentOrder[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

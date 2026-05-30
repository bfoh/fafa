'use client';

import type { CartItem } from '@/hooks/use-cart';

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

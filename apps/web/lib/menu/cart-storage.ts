import type { CartItem } from '@/hooks/use-cart';

const KEY = (slug: string) => `fafa_cart_${slug}`;

// Merge an item into a cart the same way use-cart does: match by menuItemId,
// otherwise append. Pure — used by Adepa to build the cart, and unit-tested.
export function mergeCart(items: CartItem[], add: CartItem): CartItem[] {
  const i = items.findIndex((x) => x.menuItemId === add.menuItemId);
  if (i >= 0) {
    const copy = [...items];
    copy[i] = { ...copy[i], quantity: copy[i].quantity + add.quantity };
    return copy;
  }
  return [...items, add];
}

function read(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY(slug));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function write(slug: string, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY(slug), JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export function addToCart(slug: string, item: CartItem): number {
  const next = mergeCart(read(slug), item);
  write(slug, next);
  return next.reduce((n, i) => n + i.quantity, 0);
}

export function cartCount(slug: string): number {
  return read(slug).reduce((n, i) => n + i.quantity, 0);
}

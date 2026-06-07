/**
 * @fafa/storefront — shared customer-storefront surface consumed by both
 * apps/web (via re-export shims at the original paths) and apps/mobile (the
 * Capacitor shell). All modules are client-safe: zero server-only/secret code
 * lives here.
 */

// API contract (shared with apps/web routes)
export {
  shapeMenuCategories,
  type StorefrontPayload,
  type StorefrontTenant,
  type StorefrontCategory,
  type StorefrontMenuItem,
  type StorefrontMenuOption,
  type OrderTenantContact,
  type OrderTrackingPayload,
  type VerifyResult,
} from './lib/storefront/payload';

// Components
export { StorefrontMenu } from './components/storefront/storefront-menu';
export {
  OrderTracker,
  type TrackedOrder,
  type HistoryEntry,
} from './components/storefront/order-tracker';
export { BrandingCache } from './components/storefront/branding-cache';
export { AdepaConversion } from './components/adepa/adepa-conversion';
export { AdepaWidget } from './components/adepa/adepa-widget';

// Hooks
export { CartProvider, useCart, type CartItem } from './hooks/use-cart';

// Lib — client utils
export { formatCurrency, formatGHS } from './lib/utils/currency';
export { waNumber, waLink, waShare } from './lib/utils/whatsapp';
export {
  normalizeGhanaPhone,
  isValidGhanaPhone,
  formatGhanaPhone,
} from './lib/utils/phone';
export {
  saveCustomer,
  loadCustomer,
  saveLastOrder,
  loadLastOrder,
  type SavedCustomer,
  type LastOrder,
} from './lib/utils/customer-prefs';
export { createBrowserClient } from './lib/supabase/client';
export { mergeCart, addToCart, cartCount } from './lib/menu/cart-storage';
export { correctFoodNames } from './lib/adepa/food-vocab';
export {
  getConversationId,
  setAttribution,
  takeAttribution,
  pingOutcome,
} from './lib/adepa/session';

// Which orders a restaurant should see/act on. Online orders (momo/card) only
// reach the kitchen once payment is confirmed; cash-on-delivery is visible
// immediately since payment happens at handover. Keep the TS predicate and the
// PostgREST filter string in lockstep.

export const VISIBLE_ORDER_FILTER =
  'payment_status.eq.paid,payment_method.eq.cash_on_delivery';

export function isVisibleToRestaurant(o: {
  payment_status?: string | null;
  payment_method?: string | null;
}): boolean {
  return o.payment_status === 'paid' || o.payment_method === 'cash_on_delivery';
}

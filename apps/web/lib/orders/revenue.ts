// Single source of truth for "does this order count as realized revenue".
//
// An order is revenue once its payment is settled, i.e. payment_status = 'paid':
//   - online payments confirmed by Paystack (webhook OR callback verification)
//   - cash-on-delivery, marked paid when the order is delivered
// All settlement paths set payment_status = 'paid', so this one predicate is the
// authoritative revenue rule across every dashboard. Do NOT count by status
// (e.g. 'delivered'); that double-counted unconfirmed online orders.

export function isPaidOrder(o: { payment_status?: string | null }): boolean {
  return o.payment_status === 'paid';
}

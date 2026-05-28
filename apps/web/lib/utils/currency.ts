/**
 * Format an amount in Ghana Cedis.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a compact currency display (e.g. "GH₵ 35.00")
 */
export function formatGHS(amount: number): string {
  return `GH₵ ${amount.toFixed(2)}`;
}

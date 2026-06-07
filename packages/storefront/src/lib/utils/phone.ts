/**
 * Normalize a Ghana phone number to international format (+233XXXXXXXXX).
 */
export function normalizeGhanaPhone(phone: string): string {
  let clean = phone.replace(/[\s\-()]/g, '');

  // Convert 0XX to +233XX
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '+233' + clean.substring(1);
  }
  // Add + if starts with 233
  if (clean.startsWith('233') && !clean.startsWith('+')) {
    clean = '+' + clean;
  }

  return clean;
}

/**
 * Validate a Ghana phone number (MTN, Vodafone, AirtelTigo).
 */
export function isValidGhanaPhone(phone: string): boolean {
  const normalized = normalizeGhanaPhone(phone);
  // +233 followed by 9 digits
  return /^\+233[0-9]{9}$/.test(normalized);
}

/**
 * Format phone for display: 024 123 4567
 */
export function formatGhanaPhone(phone: string): string {
  const normalized = normalizeGhanaPhone(phone);
  if (!normalized.startsWith('+233') || normalized.length !== 13) {
    return phone;
  }
  const local = '0' + normalized.substring(4);
  return `${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}`;
}

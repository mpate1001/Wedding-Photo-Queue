/**
 * Normalize a phone number string to its last 10 digits.
 * Returns null if the input has fewer than 10 digits after stripping non-digits.
 *
 * Used for matching guests across messy Google Sheets formats and WhatsApp's
 * +CCXXXXXXXXXX canonical format. Last-10 matching is a deliberate simplification:
 * for a 700-guest list, the false positive rate of two different numbers sharing
 * the same last 10 digits is acceptable.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Returns true if two phone numbers refer to the same person based on
 * their last 10 digits. Returns false if either input is unparseable.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na === null || nb === null) return false;
  return na === nb;
}

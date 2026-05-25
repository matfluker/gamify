// Phone normalization. Built so SMS verification can be added later
// without changing how accounts are keyed.
//
// Strategy: strip non-digits, drop a leading "1" if the result is 11 digits
// (US country code), and store as a digits-only string.
export function normalizePhone(input) {
  if (!input) return '';
  const digits = String(input).replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function isValidPhone(input) {
  const n = normalizePhone(input);
  // Accept 10-digit US numbers; allow 7-15 to be permissive for international tests.
  return n.length >= 7 && n.length <= 15;
}

export function formatPhoneForDisplay(input) {
  const n = normalizePhone(input);
  if (n.length === 10) return `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`;
  return n;
}

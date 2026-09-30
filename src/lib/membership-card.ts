// Membership card helpers (pure). Cards carry the customer's membership number as a Code 128 barcode; a scanner
// simply types the number into any search box, so lookups accept the number with or without leading zeros.

/** A whole-number scan/typing ("123", "000123", " 000123\n") -> the canonical 6-digit membership number, else null. */
export function normalizeMemberNumber(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return /^\d{1,6}$/.test(t) ? t.padStart(6, "0") : null;
}

/** Barcode text must be plain and short so it is always safe to embed and always scannable. */
export const isBarcodeSafe = (text: string) => /^[A-Za-z0-9-]{1,20}$/.test(text);

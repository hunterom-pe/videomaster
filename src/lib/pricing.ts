// Money is handled in integer cents to avoid floating-point drift. Pure functions, safe on client and server.

export const toCents = (amount: number | string | { toString(): string }): number => Math.round(Number(amount.toString()) * 100);
export const fromCents = (cents: number): string => (cents / 100).toFixed(2);
export const fmtMoney = (cents: number): string => `$${fromCents(cents)}`;

/** Sales tax on a taxable amount, rounded half-up to the cent. `percent` may have up to 3 decimals (e.g. 8.625). */
export function taxCents(taxableCents: number, percent: number | string): number {
  const milli = Math.round(Number(percent) * 1000); // percent in thousandths
  return Math.floor((taxableCents * milli + 50_000) / 100_000);
}

/** Due date = rental moment plus N days. */
export function dueDate(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

export const fmtDate = (d: Date): string =>
  d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).toUpperCase();

export type PriceLine = { cents: number; taxable: boolean };

/** Rentals and merchandise are taxed together on the sum of taxable lines, rounded once (half-up). */
export function computeTotals(rentals: PriceLine[], merchandise: PriceLine[], taxPercent: number | string) {
  const sum = (ls: PriceLine[]) => ls.reduce((n, l) => n + l.cents, 0);
  const rentalCents = sum(rentals);
  const merchCents = sum(merchandise);
  const taxableCents = sum(rentals.filter((l) => l.taxable)) + sum(merchandise.filter((l) => l.taxable));
  const tax = taxCents(taxableCents, taxPercent);
  return { rentalCents, merchCents, subtotal: rentalCents + merchCents, tax, total: rentalCents + merchCents + tax };
}

/** MM/DD/YYYY (UTC calendar date, consistent with the rest of the app). */
export const fmtDateUS = (d: Date): string => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;

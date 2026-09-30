// Cash tendered and change. Pure helpers shared by the browser (live change display) and the server (the real check).
// Amounts are integer cents.

const MAX_TENDER_CENTS = 9_999_999; // $99,999.99

/** "20", "20.5", "20.00" -> cents; "" -> null (blank); anything else -> NaN (invalid). */
export function parseTender(raw: string | null | undefined): number | null {
  const t = (raw ?? "").trim().replace(/^\$/, "");
  if (t === "") return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return NaN;
  const cents = Math.round(Number(t) * 100);
  return cents > MAX_TENDER_CENTS ? NaN : cents;
}

export const changeDueCents = (totalCents: number, tenderedCents: number) => tenderedCents - totalCents;

/** Quick-pick amounts: exact, then the smallest bills that cover the total (max 5 buttons). */
export function quickTenders(totalCents: number): number[] {
  const bills = [500, 1000, 2000, 5000, 10000].filter((b) => b >= totalCents);
  const nextDollar = Math.ceil(totalCents / 100) * 100;
  return [...new Set([totalCents, nextDollar, ...bills])].sort((a, b) => a - b).slice(0, 5);
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export type TenderResult = { ok: true; tenderedCents: number | null } | { ok: false; message: string };

/**
 * Server-side rule. Only CASH payments with money actually due record a tender. A blank amount means exact cash;
 * an amount below the total is rejected. `total` is always the server-computed figure.
 */
export function resolveTender(method: string, totalCents: number, raw: string | null | undefined): TenderResult {
  if (method !== "CASH" || totalCents <= 0) return { ok: true, tenderedCents: null };
  const parsed = parseTender(raw);
  if (parsed === null) return { ok: true, tenderedCents: totalCents };
  if (Number.isNaN(parsed)) return { ok: false, message: "CASH TENDERED MUST BE A DOLLAR AMOUNT SUCH AS 20 OR 20.00." };
  if (parsed < totalCents) return { ok: false, message: `CASH TENDERED (${money(parsed)}) IS LESS THAN THE AMOUNT DUE (${money(totalCents)}).` };
  return { ok: true, tenderedCents: parsed };
}

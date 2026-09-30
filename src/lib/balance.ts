// Customer account balances (fees put on account). Pure helpers shared by browser and server. Amounts are integer cents.
import { parseTender } from "@/lib/cash";

export type PaidNowResult = { ok: true; paidCents: number; unpaidCents: number } | { ok: false; message: string };

/** How much of `totalCents` is paid now; the rest goes on the customer's account. Blank = pay everything now. */
export function resolvePaidNow(totalCents: number, raw: string | null | undefined): PaidNowResult {
  const parsed = parseTender(raw);
  if (parsed === null) return { ok: true, paidCents: totalCents, unpaidCents: 0 };
  if (Number.isNaN(parsed)) return { ok: false, message: "AMOUNT PAID NOW MUST BE A DOLLAR AMOUNT SUCH AS 2 OR 2.00." };
  if (parsed > totalCents) return { ok: false, message: `AMOUNT PAID NOW CANNOT EXCEED THE FEES DUE ($${(totalCents / 100).toFixed(2)}).` };
  return { ok: true, paidCents: parsed, unpaidCents: totalCents - parsed };
}

export type AmountResult = { ok: true; cents: number } | { ok: false; message: string };

/** An amount to pay or waive against a balance. Blank = the whole balance; must be > 0 and not above the balance. */
export function resolveBalanceAmount(balanceCents: number, raw: string | null | undefined): AmountResult {
  const parsed = parseTender(raw);
  const cents = parsed === null ? balanceCents : parsed;
  if (Number.isNaN(cents)) return { ok: false, message: "AMOUNT MUST BE A DOLLAR AMOUNT SUCH AS 2 OR 2.00." };
  if (cents <= 0) return { ok: false, message: "AMOUNT MUST BE GREATER THAN ZERO." };
  if (cents > balanceCents) return { ok: false, message: `AMOUNT CANNOT EXCEED THE BALANCE DUE ($${(balanceCents / 100).toFixed(2)}).` };
  return { ok: true, cents };
}

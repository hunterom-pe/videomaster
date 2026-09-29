import { dayKeyToNumber, localDayKey, startOfLocalDay } from "@/lib/tz";

// Late-fee policy. "Days" are calendar days in the store's time zone, matching the due dates shown on screen.

/** Whole calendar days past the due date (0 if returned on or before the due date). */
export function daysLate(dueAt: Date, returnedAt: Date, tz: string): number {
  return Math.max(0, dayKeyToNumber(localDayKey(returnedAt, tz)) - dayKeyToNumber(localDayKey(dueAt, tz)));
}

/** Late fee in cents: days late x per-day fee, capped at the category's optional maximum. */
export function lateFeeCents(days: number, perDayCents: number, maxCents: number | null): number {
  const fee = days * perDayCents;
  return maxCents !== null ? Math.min(fee, maxCents) : fee;
}

/** Start of the store-local day containing `d`. A rental is overdue iff its dueAt is before this cutoff. */
export const overdueCutoff = (d: Date, tz: string): Date => startOfLocalDay(d, tz);

/** Late fee accrued so far on an unreturned rental. */
export function accruedLateFeeCents(dueAt: Date, now: Date, perDayCents: number, maxCents: number | null, tz: string): number {
  return lateFeeCents(daysLate(dueAt, now, tz), perDayCents, maxCents);
}

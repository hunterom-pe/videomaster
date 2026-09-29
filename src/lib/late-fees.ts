// Late-fee policy. Dates are compared as UTC calendar dates, matching the due dates shown on screen.
const DAY = 86_400_000;
const utcDay = (d: Date) => Math.floor(d.getTime() / DAY);

/** Whole calendar days past the due date (0 if returned on or before the due date). */
export function daysLate(dueAt: Date, returnedAt: Date): number {
  return Math.max(0, utcDay(returnedAt) - utcDay(dueAt));
}

/** Late fee in cents: days late × per-day fee, capped at the category's optional maximum. */
export function lateFeeCents(days: number, perDayCents: number, maxCents: number | null): number {
  const fee = days * perDayCents;
  return maxCents !== null ? Math.min(fee, maxCents) : fee;
}

/** Start (00:00 UTC) of the day containing `d`. A rental is overdue iff its dueAt is before this cutoff. */
export const startOfUtcDay = (d: Date): Date => new Date(Math.floor(d.getTime() / DAY) * DAY);

/** Late fee accrued so far on an unreturned rental. */
export function accruedLateFeeCents(dueAt: Date, now: Date, perDayCents: number, maxCents: number | null): number {
  return lateFeeCents(daysLate(dueAt, now), perDayCents, maxCents);
}

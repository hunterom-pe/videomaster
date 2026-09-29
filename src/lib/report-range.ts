import { parseDay } from "@/lib/dates";

const DAY = 86_400_000;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const startOfUtcDay = (d: Date) => new Date(Math.floor(d.getTime() / DAY) * DAY);

export type Range = {
  from: Date; // inclusive, UTC midnight
  toExclusive: Date; // UTC midnight after the last selected day
  fromStr: string;
  toStr: string; // inclusive last day
  invalid: boolean; // user input was ignored
};

/** Resolve ?from=&to= (YYYY-MM-DD, UTC days) with a default window ending today. Swaps reversed ranges. */
export function resolveRange(rawFrom: string | undefined, rawTo: string | undefined, defaultDays: number, now = new Date()): Range {
  const today = startOfUtcDay(now);
  let invalid = false;
  const f = rawFrom ? parseDay(rawFrom) : null;
  const t = rawTo ? parseDay(rawTo) : null;
  if ((rawFrom && !f) || (rawTo && !t)) invalid = true;
  let to = t ?? today;
  let from = f ?? new Date(to.getTime() - (defaultDays - 1) * DAY);
  if (from > to) [from, to] = [to, from];
  return { from, toExclusive: new Date(to.getTime() + DAY), fromStr: isoDay(from), toStr: isoDay(to), invalid };
}

/** Single-day report date (defaults to today UTC). */
export function resolveDay(raw: string | undefined, now = new Date()): { day: Date; dayStr: string; next: Date; invalid: boolean } {
  const parsed = raw ? parseDay(raw) : null;
  const day = parsed ?? startOfUtcDay(now);
  return { day, dayStr: isoDay(day), next: new Date(day.getTime() + DAY), invalid: !!raw && !parsed };
}

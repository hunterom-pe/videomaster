import { parseDay } from "@/lib/dates";
import { addDaysToKey, localDayKey, zonedMidnight } from "@/lib/tz";

export type Range = {
  from: Date; // instant of 00:00 (store zone) on the first selected day
  toExclusive: Date; // instant of 00:00 (store zone) on the day after the last selected day
  fromStr: string; // YYYY-MM-DD, store-local
  toStr: string; // inclusive last day
  invalid: boolean; // user input was ignored
};

/** Resolve ?from=&to= (YYYY-MM-DD store-local days) with a default window ending today. Swaps reversed ranges. */
export function resolveRange(rawFrom: string | undefined, rawTo: string | undefined, defaultDays: number, tz: string, now = new Date()): Range {
  const today = localDayKey(now, tz);
  const okFrom = rawFrom && parseDay(rawFrom) ? rawFrom : null;
  const okTo = rawTo && parseDay(rawTo) ? rawTo : null;
  const invalid = !!((rawFrom && !okFrom) || (rawTo && !okTo));
  let to = okTo ?? today;
  let from = okFrom ?? addDaysToKey(to, -(defaultDays - 1));
  if (from > to) [from, to] = [to, from];
  return { from: zonedMidnight(from, tz), toExclusive: zonedMidnight(addDaysToKey(to, 1), tz), fromStr: from, toStr: to, invalid };
}

/** Single-day report date (defaults to today in the store's zone). */
export function resolveDay(raw: string | undefined, tz: string, now = new Date()): { day: Date; dayStr: string; next: Date; invalid: boolean } {
  const ok = raw && parseDay(raw) ? raw : null;
  const key = ok ?? localDayKey(now, tz);
  return { day: zonedMidnight(key, tz), dayStr: key, next: zonedMidnight(addDaysToKey(key, 1), tz), invalid: !!raw && !ok };
}

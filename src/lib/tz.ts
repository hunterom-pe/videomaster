// Time-zone helpers (pure; safe on client and server). A store's "day" is a calendar day in its own IANA zone,
// so Arizona (America/Phoenix, UTC-7 all year, no daylight saving) and DST zones both behave correctly.

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "EASTERN (NEW YORK)" },
  { value: "America/Chicago", label: "CENTRAL (CHICAGO)" },
  { value: "America/Denver", label: "MOUNTAIN (DENVER)" },
  { value: "America/Phoenix", label: "ARIZONA (PHOENIX) — MST, NO DAYLIGHT SAVING" },
  { value: "America/Los_Angeles", label: "PACIFIC (LOS ANGELES)" },
  { value: "America/Anchorage", label: "ALASKA (ANCHORAGE)" },
  { value: "Pacific/Honolulu", label: "HAWAII (HONOLULU) — NO DAYLIGHT SAVING" },
  { value: "America/Toronto", label: "CANADA EASTERN (TORONTO)" },
  { value: "America/Winnipeg", label: "CANADA CENTRAL (WINNIPEG)" },
  { value: "America/Edmonton", label: "CANADA MOUNTAIN (EDMONTON)" },
  { value: "America/Vancouver", label: "CANADA PACIFIC (VANCOUVER)" },
  { value: "America/Halifax", label: "CANADA ATLANTIC (HALIFAX)" },
  { value: "America/St_Johns", label: "NEWFOUNDLAND (ST. JOHN'S)" },
  { value: "Europe/London", label: "UNITED KINGDOM (LONDON)" },
  { value: "Europe/Paris", label: "CENTRAL EUROPE (PARIS)" },
  { value: "Australia/Sydney", label: "AUSTRALIA EASTERN (SYDNEY)" },
  { value: "UTC", label: "UTC" },
];

export const DEFAULT_TIMEZONE = "America/Phoenix";
const DAY = 86_400_000;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length > 0;
  } catch {
    return false;
  }
}

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

function partsIn(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** Offset of the zone from UTC at an instant, in ms (Phoenix = -7h always; New York = -5h or -4h). */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = partsIn(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar date (YYYY-MM-DD) of an instant in the store's zone. */
export function localDayKey(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Days since epoch for a YYYY-MM-DD key (for calendar-day arithmetic). */
export function dayKeyToNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

export function addDaysToKey(key: string, n: number): string {
  return new Date((dayKeyToNumber(key) + n) * DAY).toISOString().slice(0, 10);
}

/** The instant of 00:00 local time on a YYYY-MM-DD day in the zone (handles daylight-saving changes). */
export function zonedMidnight(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = tzOffsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

/** Start of the store-local day containing `date`. */
export const startOfLocalDay = (date: Date, tz: string): Date => zonedMidnight(localDayKey(date, tz), tz);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "SEP 29" in the store's zone. */
export function fmtDateTz(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${MONTHS[p.m - 1]} ${pad(p.d)}`;
}

/** "09/29/2026" in the store's zone. */
export function fmtDateUSTz(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${pad(p.m)}/${pad(p.d)}/${p.y}`;
}

/** "2026-09-29 15:11" in the store's zone. */
export function fmtDateTimeTz(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

/** Short zone name at an instant, e.g. "MST" or "EDT". */
export function tzAbbrev(tz: string, date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(date).find((x) => x.type === "timeZoneName");
  return (part?.value ?? tz).toUpperCase();
}

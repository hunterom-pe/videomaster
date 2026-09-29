// Membership terms (pure; safe on client and server).

/** Add calendar months in UTC, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export type MembershipState = "NONE" | "ACTIVE" | "EXPIRED";

/** NONE = no expiry tracked (lifetime / pre-existing customer); EXPIRED only when an expiry date is set and past. */
export function membershipState(expiresAt: Date | null, now: Date): MembershipState {
  if (!expiresAt) return "NONE";
  return expiresAt.getTime() < now.getTime() ? "EXPIRED" : "ACTIVE";
}

/** Renewal extends from the later of now and the current expiry, so early renewals lose no time. */
export function renewedExpiry(currentExpiry: Date | null, now: Date, termMonths: number): Date | null {
  if (termMonths <= 0) return null;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return addMonths(base, termMonths);
}

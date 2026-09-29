import { describe, expect, it } from "vitest";
import { addMonths, membershipState, renewedExpiry } from "@/lib/membership";

const d = (s: string) => new Date(s);

describe("addMonths", () => {
  it("adds calendar months", () => expect(addMonths(d("2026-01-15T10:00:00Z"), 12).toISOString()).toBe("2027-01-15T10:00:00.000Z"));
  it("clamps to the end of shorter months", () => {
    expect(addMonths(d("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(d("2024-01-31T00:00:00Z"), 1).toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });
  it("crosses year boundaries", () => expect(addMonths(d("2026-11-30T00:00:00Z"), 3).toISOString()).toBe("2027-02-28T00:00:00.000Z"));
});

describe("membershipState", () => {
  const now = d("2026-09-29T12:00:00Z");
  it("is NONE without an expiry", () => expect(membershipState(null, now)).toBe("NONE"));
  it("is ACTIVE before and EXPIRED after the expiry", () => {
    expect(membershipState(d("2026-10-01T00:00:00Z"), now)).toBe("ACTIVE");
    expect(membershipState(d("2026-09-01T00:00:00Z"), now)).toBe("EXPIRED");
  });
});

describe("renewedExpiry", () => {
  const now = d("2026-09-29T12:00:00Z");
  it("returns null when memberships never expire", () => expect(renewedExpiry(null, now, 0)).toBeNull());
  it("extends from now when expired or new", () => {
    expect(renewedExpiry(d("2026-01-01T00:00:00Z"), now, 12)?.toISOString()).toBe("2027-09-29T12:00:00.000Z");
    expect(renewedExpiry(null, now, 6)?.toISOString()).toBe("2027-03-29T12:00:00.000Z");
  });
  it("extends from the current expiry when renewing early", () => {
    expect(renewedExpiry(d("2026-12-01T00:00:00Z"), now, 12)?.toISOString()).toBe("2027-12-01T00:00:00.000Z");
  });
});

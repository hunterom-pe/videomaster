import { describe, expect, it } from "vitest";
import { resolveDay, resolveRange } from "@/lib/report-range";

const PHX = "America/Phoenix";
const now = new Date("2026-09-30T03:30:00Z"); // 8:30pm Sep 29 in Arizona; already Sep 30 in UTC

describe("resolveRange", () => {
  it("defaults to a window ending today IN THE STORE ZONE (Arizona evening is still Sep 29)", () => {
    const r = resolveRange(undefined, undefined, 30, PHX, now);
    expect(r.toStr).toBe("2026-09-29");
    expect(r.fromStr).toBe("2026-08-31");
    expect(r.toExclusive.toISOString()).toBe("2026-09-30T07:00:00.000Z"); // Sep 30 00:00 Arizona
    expect(r.invalid).toBe(false);
  });
  it("uses explicit dates inclusively as local days", () => {
    const r = resolveRange("1996-09-01", "1996-09-30", 30, PHX, now);
    expect(r.from.toISOString()).toBe("1996-09-01T07:00:00.000Z");
    expect(r.toExclusive.toISOString()).toBe("1996-10-01T07:00:00.000Z");
  });
  it("swaps reversed ranges and flags junk input", () => {
    const r = resolveRange("2026-09-10", "2026-09-01", 30, PHX, now);
    expect(r.fromStr).toBe("2026-09-01");
    expect(r.toStr).toBe("2026-09-10");
    expect(resolveRange("nope", undefined, 30, PHX, now).invalid).toBe(true);
  });
  it("respects daylight saving in other zones", () => {
    const r = resolveRange("2026-03-08", "2026-03-08", 1, "America/New_York", now);
    expect(r.from.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(r.toExclusive.toISOString()).toBe("2026-03-09T04:00:00.000Z"); // a 23-hour day
  });
});

describe("resolveDay", () => {
  it("defaults to today in the store zone and validates", () => {
    expect(resolveDay(undefined, PHX, now).dayStr).toBe("2026-09-29");
    expect(resolveDay(undefined, "UTC", now).dayStr).toBe("2026-09-30");
    expect(resolveDay("1996-02-30", PHX, now).invalid).toBe(true);
    expect(resolveDay("1996-02-29", PHX, now).next.toISOString()).toBe("1996-03-01T07:00:00.000Z");
  });
});

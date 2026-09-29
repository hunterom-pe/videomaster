import { describe, expect, it } from "vitest";
import {
  addDaysToKey, dayKeyToNumber, fmtDateTimeTz, fmtDateTz, fmtDateUSTz, isValidTimeZone, localDayKey, startOfLocalDay, tzAbbrev, tzOffsetMs, zonedMidnight,
} from "@/lib/tz";

const PHX = "America/Phoenix";
const NY = "America/New_York";

describe("Arizona (America/Phoenix): UTC-7, no daylight saving", () => {
  it("has a constant -7h offset in summer and winter", () => {
    expect(tzOffsetMs(new Date("2026-07-01T12:00:00Z"), PHX)).toBe(-7 * 3_600_000);
    expect(tzOffsetMs(new Date("2026-01-01T12:00:00Z"), PHX)).toBe(-7 * 3_600_000);
  });
  it("puts an evening rental on the correct local day (the old UTC bug)", () => {
    // 8:30pm Arizona on Sep 29 is 03:30Z on Sep 30
    const evening = new Date("2026-09-30T03:30:00Z");
    expect(localDayKey(evening, PHX)).toBe("2026-09-29");
    expect(fmtDateTz(evening, PHX)).toBe("SEP 29");
    expect(fmtDateUSTz(evening, PHX)).toBe("09/29/2026");
    expect(fmtDateTimeTz(evening, PHX)).toBe("2026-09-29 20:30");
  });
  it("local midnight is 07:00Z", () => {
    expect(zonedMidnight("2026-09-29", PHX).toISOString()).toBe("2026-09-29T07:00:00.000Z");
    expect(startOfLocalDay(new Date("2026-09-30T03:30:00Z"), PHX).toISOString()).toBe("2026-09-29T07:00:00.000Z");
  });
  it("abbreviates as MST all year", () => {
    expect(tzAbbrev(PHX, new Date("2026-07-01T12:00:00Z"))).toMatch(/MST/);
    expect(tzAbbrev(PHX, new Date("2026-01-01T12:00:00Z"))).toMatch(/MST/);
  });
});

describe("daylight-saving zones", () => {
  it("handles the spring-forward day (New York, 2026-03-08)", () => {
    expect(zonedMidnight("2026-03-08", NY).toISOString()).toBe("2026-03-08T05:00:00.000Z"); // EST
    expect(zonedMidnight("2026-03-09", NY).toISOString()).toBe("2026-03-09T04:00:00.000Z"); // EDT
  });
  it("handles the fall-back day (New York, 2026-11-01)", () => {
    expect(zonedMidnight("2026-11-01", NY).toISOString()).toBe("2026-11-01T04:00:00.000Z"); // EDT
    expect(zonedMidnight("2026-11-02", NY).toISOString()).toBe("2026-11-02T05:00:00.000Z"); // EST
  });
  it("UTC behaves like UTC", () => expect(zonedMidnight("2026-09-29", "UTC").toISOString()).toBe("2026-09-29T00:00:00.000Z"));
});

describe("day keys", () => {
  it("does calendar arithmetic across months and leap days", () => {
    expect(addDaysToKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysToKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysToKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(dayKeyToNumber("2026-09-30") - dayKeyToNumber("2026-09-27")).toBe(3);
  });
  it("validates zone names", () => {
    expect(isValidTimeZone("America/Phoenix")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

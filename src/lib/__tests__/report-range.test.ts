import { describe, expect, it } from "vitest";
import { resolveDay, resolveRange } from "@/lib/report-range";

const now = new Date("2026-09-29T22:30:00Z");

describe("resolveRange", () => {
  it("defaults to a window ending today", () => {
    const r = resolveRange(undefined, undefined, 30, now);
    expect(r.toStr).toBe("2026-09-29");
    expect(r.fromStr).toBe("2026-08-31");
    expect(r.toExclusive.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(r.invalid).toBe(false);
  });
  it("uses explicit dates inclusively", () => {
    const r = resolveRange("1996-09-01", "1996-09-30", 30, now);
    expect(r.from.toISOString()).toBe("1996-09-01T00:00:00.000Z");
    expect(r.toExclusive.toISOString()).toBe("1996-10-01T00:00:00.000Z");
  });
  it("swaps reversed ranges and flags junk input", () => {
    const r = resolveRange("2026-09-10", "2026-09-01", 30, now);
    expect(r.fromStr).toBe("2026-09-01");
    expect(r.toStr).toBe("2026-09-10");
    expect(resolveRange("nope", undefined, 30, now).invalid).toBe(true);
  });
});

describe("resolveDay", () => {
  it("defaults to today and validates", () => {
    expect(resolveDay(undefined, now).dayStr).toBe("2026-09-29");
    expect(resolveDay("1996-02-30", now).invalid).toBe(true);
    expect(resolveDay("1996-02-29", now).next.toISOString()).toBe("1996-03-01T00:00:00.000Z");
  });
});

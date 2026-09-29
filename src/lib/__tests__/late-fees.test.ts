import { describe, expect, it } from "vitest";
import { accruedLateFeeCents, daysLate, lateFeeCents, overdueCutoff } from "@/lib/late-fees";

const d = (s: string) => new Date(s);
const PHX = "America/Phoenix";
const UTC = "UTC";

describe("daysLate", () => {
  it("is 0 on the due date, even late in the day", () => {
    expect(daysLate(d("2026-10-01T09:00:00Z"), d("2026-10-01T23:59:00Z"), UTC)).toBe(0);
  });
  it("is 0 when early", () => expect(daysLate(d("2026-10-01T09:00:00Z"), d("2026-09-30T10:00:00Z"), UTC)).toBe(0));
  it("counts calendar days past due (spec example: due 9/27, returned 9/30 = 3)", () => {
    expect(daysLate(d("1999-09-27T15:00:00Z"), d("1999-09-30T10:00:00Z"), UTC)).toBe(3);
  });
  it("is 1 the day after due", () => expect(daysLate(d("2026-10-01T23:00:00Z"), d("2026-10-02T01:00:00Z"), UTC)).toBe(1));

  it("uses the store's local calendar (Arizona): a 8pm rental due 'Oct 1' is not late at 9pm Oct 1", () => {
    // due Oct 1 8pm Arizona = Oct 2 03:00Z ; returned Oct 1 9pm Arizona = Oct 2 04:00Z -> same local day
    expect(daysLate(d("2026-10-02T03:00:00Z"), d("2026-10-02T04:00:00Z"), PHX)).toBe(0);
    // the same instants are also same UTC day here, so check a case where UTC and Arizona disagree:
    // returned Oct 2 1am Arizona = Oct 2 08:00Z (next local day) -> 1 day late in Arizona
    expect(daysLate(d("2026-10-02T03:00:00Z"), d("2026-10-02T08:00:00Z"), PHX)).toBe(1);
    expect(daysLate(d("2026-10-02T03:00:00Z"), d("2026-10-02T08:00:00Z"), UTC)).toBe(0);
  });
});

describe("lateFeeCents", () => {
  it("multiplies days by the daily fee", () => expect(lateFeeCents(3, 100, null)).toBe(300));
  it("is zero when not late", () => expect(lateFeeCents(0, 100, null)).toBe(0));
  it("caps at the category maximum", () => {
    expect(lateFeeCents(20, 100, 800)).toBe(800);
    expect(lateFeeCents(3, 100, 800)).toBe(300);
  });
});

describe("overdue helpers", () => {
  it("overdueCutoff is the start of the local day", () => {
    expect(overdueCutoff(d("2026-10-02T15:30:00Z"), UTC).toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(overdueCutoff(d("2026-10-03T03:30:00Z"), PHX).toISOString()).toBe("2026-10-02T07:00:00.000Z"); // still Oct 2 in Arizona
  });
  it("a rental due earlier today is NOT overdue; due yesterday is", () => {
    const cutoff = overdueCutoff(d("2026-10-02T15:30:00Z"), UTC);
    expect(d("2026-10-02T09:00:00Z") < cutoff).toBe(false);
    expect(d("2026-10-01T23:59:00Z") < cutoff).toBe(true);
  });
  it("accrued fee uses days late and the cap", () => {
    expect(accruedLateFeeCents(d("2026-09-26T10:00:00Z"), d("2026-09-29T09:00:00Z"), 100, null, UTC)).toBe(300);
    expect(accruedLateFeeCents(d("2026-09-01T10:00:00Z"), d("2026-09-29T09:00:00Z"), 100, 500, UTC)).toBe(500);
    expect(accruedLateFeeCents(d("2026-09-29T10:00:00Z"), d("2026-09-29T20:00:00Z"), 100, null, UTC)).toBe(0);
  });
});

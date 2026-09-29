import { describe, expect, it } from "vitest";
import { daysLate, lateFeeCents } from "@/lib/late-fees";

const d = (s: string) => new Date(s);

describe("daysLate", () => {
  it("is 0 on the due date, even late in the day", () => {
    expect(daysLate(d("2026-10-01T09:00:00Z"), d("2026-10-01T23:59:00Z"))).toBe(0);
  });
  it("is 0 when early", () => expect(daysLate(d("2026-10-01T09:00:00Z"), d("2026-09-30T10:00:00Z"))).toBe(0));
  it("counts calendar days past due (spec example: due 9/27, returned 9/30 = 3)", () => {
    expect(daysLate(d("1999-09-27T15:00:00Z"), d("1999-09-30T10:00:00Z"))).toBe(3);
  });
  it("is 1 the day after due", () => expect(daysLate(d("2026-10-01T23:00:00Z"), d("2026-10-02T01:00:00Z"))).toBe(1));
});

describe("lateFeeCents", () => {
  it("multiplies days by the daily fee", () => expect(lateFeeCents(3, 100, null)).toBe(300));
  it("is zero when not late", () => expect(lateFeeCents(0, 100, null)).toBe(0));
  it("caps at the category maximum", () => {
    expect(lateFeeCents(20, 100, 800)).toBe(800);
    expect(lateFeeCents(3, 100, 800)).toBe(300);
  });
});

import { accruedLateFeeCents, startOfUtcDay } from "@/lib/late-fees";

describe("overdue helpers", () => {
  it("startOfUtcDay truncates to midnight UTC", () => expect(startOfUtcDay(d("2026-10-02T15:30:00Z")).toISOString()).toBe("2026-10-02T00:00:00.000Z"));
  it("a rental due earlier today is NOT overdue; due yesterday is", () => {
    const cutoff = startOfUtcDay(d("2026-10-02T15:30:00Z"));
    expect(d("2026-10-02T09:00:00Z") < cutoff).toBe(false);
    expect(d("2026-10-01T23:59:00Z") < cutoff).toBe(true);
  });
  it("accrued fee uses days late and the cap", () => {
    expect(accruedLateFeeCents(d("2026-09-26T10:00:00Z"), d("2026-09-29T09:00:00Z"), 100, null)).toBe(300);
    expect(accruedLateFeeCents(d("2026-09-01T10:00:00Z"), d("2026-09-29T09:00:00Z"), 100, 500)).toBe(500);
    expect(accruedLateFeeCents(d("2026-09-29T10:00:00Z"), d("2026-09-29T20:00:00Z"), 100, null)).toBe(0);
  });
});

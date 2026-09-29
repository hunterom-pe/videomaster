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

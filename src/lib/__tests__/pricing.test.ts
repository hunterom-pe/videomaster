import { describe, expect, it } from "vitest";
import { dueDate, fmtMoney, taxCents, toCents } from "@/lib/pricing";

describe("pricing", () => {
  it("converts to cents without float drift", () => {
    expect(toCents("3.99")).toBe(399);
    expect(toCents("1.10")).toBe(110);
    expect(toCents("0.29")).toBe(29);
    expect(toCents({ toString: () => "4.49" })).toBe(449);
  });
  it("rounds tax half-up to the cent", () => {
    expect(taxCents(1000, "8.6")).toBe(86); // $10.00 @ 8.6% = $0.86
    expect(taxCents(598 + 149, "8.6")).toBe(64); // spec receipt example: $7.47 @ ~8.6% ≈ $0.64
    expect(taxCents(1050, "10")).toBe(105);
    expect(taxCents(105, "5")).toBe(5); // 5.25 -> 5
    expect(taxCents(110, "5")).toBe(6); // 5.5 -> 6 (half up)
    expect(taxCents(1000, "0")).toBe(0);
    expect(taxCents(1000, "8.625")).toBe(86); // 86.25 -> 86
  });
  it("formats money", () => expect(fmtMoney(1080)).toBe("$10.80"));
  it("computes due dates", () => expect(dueDate(new Date("2026-09-29T12:00:00Z"), 2).toISOString()).toBe("2026-10-01T12:00:00.000Z"));
});

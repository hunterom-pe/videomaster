import { describe, expect, it } from "vitest";
import { computeTotals, dueDate, fmtDateUS, fmtMoney, taxCents, toCents } from "@/lib/pricing";

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

describe("computeTotals", () => {
  it("combines rentals and merchandise with one tax computation", () => {
    // spec example shape: rentals 3.99 + 1.99, merchandise 1.49 + 2.49 at 8.6%
    const t = computeTotals([{ cents: 399, taxable: true }, { cents: 199, taxable: true }], [{ cents: 149, taxable: true }, { cents: 249, taxable: true }], "8.6");
    expect(t.rentalCents).toBe(598);
    expect(t.merchCents).toBe(398);
    expect(t.subtotal).toBe(996);
    expect(t.tax).toBe(86); // 9.96 * 8.6% = 0.8566 -> 0.86
    expect(t.total).toBe(1082);
  });
  it("excludes non-taxable lines from tax", () => {
    const t = computeTotals([{ cents: 400, taxable: false }], [{ cents: 100, taxable: true }], "10");
    expect(t.tax).toBe(10);
    expect(t.total).toBe(510);
  });
  it("handles merchandise only and empty carts", () => {
    expect(computeTotals([], [{ cents: 149, taxable: true }], "8.6").total).toBe(162);
    expect(computeTotals([], [], "8.6").total).toBe(0);
  });
});

describe("fmtDateUS", () => {
  it("formats as MM/DD/YYYY in the given zone", () => {
    expect(fmtDateUS(new Date("1996-09-05T12:00:00Z"), "UTC")).toBe("09/05/1996");
    expect(fmtDateUS(new Date("1996-09-06T03:00:00Z"), "America/Phoenix")).toBe("09/05/1996"); // 8pm Sep 5 in Arizona
  });
});

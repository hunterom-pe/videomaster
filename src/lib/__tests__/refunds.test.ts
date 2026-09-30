import { describe, expect, it } from "vitest";
import { refundTaxCents, refundTotals } from "@/lib/refunds";

// Original: $10.00 taxable + $5.00 non-taxable, 8.6% tax on the taxable part = $0.86
const original = { originalTaxCents: 86, originalTaxableBaseCents: 1000 };

describe("refundTaxCents", () => {
  it("is proportional for a partial refund", () => {
    expect(refundTaxCents({ ...original, refundTaxableCents: 500, remainingTaxCents: 86, isFinalRefund: false })).toBe(43);
  });
  it("a final refund returns exactly the remaining tax (no rounding leftovers)", () => {
    expect(refundTaxCents({ ...original, refundTaxableCents: 333, remainingTaxCents: 57, isFinalRefund: true })).toBe(57);
  });
  it("never refunds more tax than remains", () => {
    expect(refundTaxCents({ ...original, refundTaxableCents: 1000, remainingTaxCents: 10, isFinalRefund: false })).toBe(10);
  });
  it("non-taxable refunds carry no tax, and untaxed originals return none", () => {
    expect(refundTaxCents({ ...original, refundTaxableCents: 0, remainingTaxCents: 86, isFinalRefund: false })).toBe(0);
    expect(refundTaxCents({ originalTaxCents: 0, originalTaxableBaseCents: 0, refundTaxableCents: 100, remainingTaxCents: 0, isFinalRefund: true })).toBe(0);
  });
  it("refunding a sale in three pieces returns exactly the original tax", () => {
    // $3.33 + $3.33 + $3.34 taxable, tax $0.86
    let remaining = 86, given = 0;
    const pieces = [333, 333, 334];
    pieces.forEach((c, i) => {
      const t = refundTaxCents({ ...original, refundTaxableCents: c, remainingTaxCents: remaining, isFinalRefund: i === pieces.length - 1 });
      given += t; remaining -= t;
    });
    expect(given).toBe(86);
    expect(remaining).toBe(0);
  });
});

describe("refundTotals", () => {
  it("adds lines and tax", () => {
    const t = refundTotals([{ cents: 500, taxable: true }, { cents: 200, taxable: false }], { ...original, remainingTaxCents: 86, isFinalRefund: false });
    expect(t).toEqual({ subtotal: 700, tax: 43, total: 743 });
  });
});

import { describe, expect, it } from "vitest";
import { stockState } from "@/lib/concessions";
import { addStockSchema, concessionSchema, zodErrors, type ConcessionFormValues } from "@/lib/validation";

const valid: ConcessionFormValues = {
  sku: "", name: "Sour Patch Kids", category: "CANDY", retailPrice: "1.49", costPrice: "", quantityOnHand: "10",
  lowStockThreshold: "5", taxable: true, active: true, barcode: "",
};
const errs = (patch: Partial<ConcessionFormValues>) => {
  const r = concessionSchema.safeParse({ ...valid, ...patch });
  return r.success ? {} : zodErrors(r.error);
};

describe("stockState", () => {
  it("classifies stock", () => {
    expect(stockState(0, 5)).toBe("OUT");
    expect(stockState(4, 5)).toBe("LOW");
    expect(stockState(5, 5)).toBe("LOW");
    expect(stockState(6, 5)).toBe("OK");
    expect(stockState(1, 0)).toBe("OK");
  });
});

describe("concessionSchema", () => {
  it("accepts valid input", () => expect(concessionSchema.safeParse(valid).success).toBe(true));
  it("rejects negative price, quantity, cost, threshold", () => {
    expect(errs({ retailPrice: "-1" }).retailPrice).toMatch(/NEGATIVE/);
    expect(errs({ quantityOnHand: "-3" }).quantityOnHand).toMatch(/NEGATIVE/);
    expect(errs({ costPrice: "-0.5" }).costPrice).toBeDefined();
    expect(errs({ lowStockThreshold: "-1" }).lowStockThreshold).toBeDefined();
  });
  it("rejects fractional quantity and bad category/sku", () => {
    expect(errs({ quantityOnHand: "2.5" }).quantityOnHand).toBeDefined();
    expect(errs({ category: "TOYS" }).category).toBeDefined();
    expect(errs({ sku: "bad sku!" }).sku).toBeDefined();
  });
  it("allows blank optional cost and sku", () => expect(errs({ costPrice: "", sku: "" })).toEqual({}));
});

describe("addStockSchema", () => {
  it("requires a positive whole number", () => {
    for (const a of ["0", "-5", "1.5", ""]) expect(addStockSchema.safeParse({ amount: a }).success).toBe(false);
    expect(addStockSchema.safeParse({ amount: "12" }).success).toBe(true);
  });
});

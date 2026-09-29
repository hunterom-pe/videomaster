import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, storeSchema, zodErrors, type StoreFormValues } from "@/lib/validation";

const valid: StoreFormValues = {
  name: "VIDEO WORLD", number: "147", address: "123 MAIN ST", city: "PHOENIX", region: "AZ",
  postalCode: "85001", phone: "(602) 555-0147", managerName: "S. CONNOR", slogan: "",
  currency: "USD", salesTaxPercent: "8.6", storeYear: "1996", onlyMoviesUpToStoreYear: true,
  rewindFee: "", damageFee: "", lostItemFee: "", replacementFee: "19.99", membershipFee: "", membershipTermMonths: "", maxRentalsOut: "",
  formats: ["VHS"], categories: DEFAULT_CATEGORIES,
};
const errorsFor = (patch: Partial<StoreFormValues>) => {
  const r = storeSchema.safeParse({ ...valid, ...patch });
  return r.success ? {} : zodErrors(r.error);
};

describe("storeSchema", () => {
  it("accepts a valid store", () => {
    const r = storeSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.salesTaxPercent).toBe(8.6);
  });
  it("rejects negative tax", () => expect(errorsFor({ salesTaxPercent: "-1" }).salesTaxPercent).toMatch(/NEGATIVE/));
  it("rejects tax over 30", () => expect(errorsFor({ salesTaxPercent: "45" }).salesTaxPercent).toBeDefined());
  it("rejects negative price", () =>
    expect(errorsFor({ categories: [{ ...DEFAULT_CATEGORIES[0], rentalPrice: "-3.99" }] })["categories.0.rentalPrice"]).toMatch(/NEGATIVE/));
  it("rejects zero and negative durations", () => {
    for (const d of ["0", "-2"])
      expect(errorsFor({ categories: [{ ...DEFAULT_CATEGORIES[0], rentalDays: d }] })["categories.0.rentalDays"]).toBeDefined();
  });
  it("rejects fractional days and 3-decimal prices", () => {
    expect(errorsFor({ categories: [{ ...DEFAULT_CATEGORIES[0], rentalDays: "1.5" }] })["categories.0.rentalDays"]).toBeDefined();
    expect(errorsFor({ categories: [{ ...DEFAULT_CATEGORIES[0], rentalPrice: "1.999" }] })["categories.0.rentalPrice"]).toBeDefined();
  });
  it("rejects negative late fee", () =>
    expect(errorsFor({ categories: [{ ...DEFAULT_CATEGORIES[0], lateFeePerDay: "-1" }] })["categories.0.lateFeePerDay"]).toBeDefined());
  it("requires at least one format and one category", () => {
    expect(errorsFor({ formats: [] }).formats).toBeDefined();
    expect(errorsFor({ categories: [] }).categories).toBeDefined();
  });
  it("rejects duplicate category names", () =>
    expect(errorsFor({ categories: [DEFAULT_CATEGORIES[0], { ...DEFAULT_CATEGORIES[0], name: "new release" }] })["categories.1.name"]).toBeDefined());
  it("allows blank store year but rejects junk", () => {
    expect(errorsFor({ storeYear: "" }).storeYear).toBeUndefined();
    expect(errorsFor({ storeYear: "96" }).storeYear).toBeDefined();
  });
  it("rejects bad store number and unknown format", () => {
    expect(errorsFor({ number: "abc" }).number).toBeDefined();
    expect(errorsFor({ formats: ["BETAMAX"] })["formats.0"]).toBeDefined();
  });
  it("treats blank optional fees as 0 and accepts valid values", () => {
    const r = storeSchema.safeParse({ ...valid, rewindFee: "1.00", membershipFee: "10", membershipTermMonths: "12", maxRentalsOut: "5" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rewindFee).toBe(1);
      expect(r.data.damageFee).toBe(0);
      expect(r.data.membershipTermMonths).toBe(12);
      expect(r.data.maxRentalsOut).toBe(5);
    }
  });
  it("rejects negative or malformed fees and membership rules", () => {
    expect(errorsFor({ rewindFee: "-1" }).rewindFee).toMatch(/NEGATIVE/);
    expect(errorsFor({ damageFee: "1.234" }).damageFee).toBeDefined();
    expect(errorsFor({ lostItemFee: "abc" }).lostItemFee).toBeDefined();
    expect(errorsFor({ membershipFee: "1000" }).membershipFee).toBeDefined();
    expect(errorsFor({ membershipTermMonths: "-3" }).membershipTermMonths).toBeDefined();
    expect(errorsFor({ membershipTermMonths: "1.5" }).membershipTermMonths).toBeDefined();
    expect(errorsFor({ maxRentalsOut: "-1" }).maxRentalsOut).toBeDefined();
    expect(errorsFor({ maxRentalsOut: "100" }).maxRentalsOut).toBeDefined();
  });
});

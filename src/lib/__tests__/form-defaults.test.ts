import { describe, expect, it } from "vitest";
import { EMPTY_CONCESSION, EMPTY_CUSTOMER, EMPTY_STORE } from "@/lib/form-defaults";
import { concessionSchema, customerSchema, storeSchema } from "@/lib/validation";

// Regression: a create form must start with EVERY field defined (a spread of a client-exported constant once
// produced undefined fields on the server and the form could not be saved).
describe("form defaults", () => {
  it("merchandise: only the user's fields are missing, no undefined keys", () => {
    for (const v of Object.values(EMPTY_CONCESSION)) expect(v).not.toBeUndefined();
    const r = concessionSchema.safeParse({ ...EMPTY_CONCESSION, name: "Ice Cream", categoryId: "cat", retailPrice: "1.99" });
    expect(r.success).toBe(true);
  });
  it("customer: valid once names are filled", () => {
    for (const v of Object.values(EMPTY_CUSTOMER)) expect(v).not.toBeUndefined();
    expect(customerSchema.safeParse({ ...EMPTY_CUSTOMER, firstName: "A", lastName: "B" }).success).toBe(true);
  });
  it("store: valid once the required fields are filled", () => {
    for (const v of Object.values(EMPTY_STORE)) expect(v).not.toBeUndefined();
    const r = storeSchema.safeParse({ ...EMPTY_STORE, name: "X", number: "1", address: "1 A", city: "C", region: "R", postalCode: "1", phone: "555", managerName: "M", salesTaxPercent: "5" });
    expect(r.success).toBe(true);
  });
});

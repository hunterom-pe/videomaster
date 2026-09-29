import { describe, expect, it } from "vitest";
import { customerSchema, zodErrors, type CustomerFormValues } from "@/lib/validation";

const valid: CustomerFormValues = {
  firstName: "Sarah", lastName: "Connor", phone: "(602) 555-0199", email: "", address: "", city: "",
  region: "", postalCode: "", dateOfBirth: "", status: "GOOD", notes: "",
};
const errs = (patch: Partial<CustomerFormValues>) => {
  const r = customerSchema.safeParse({ ...valid, ...patch });
  return r.success ? {} : zodErrors(r.error);
};

describe("customerSchema", () => {
  it("accepts minimal valid customer", () => expect(customerSchema.safeParse(valid).success).toBe(true));
  it("requires names", () => {
    expect(errs({ firstName: " " }).firstName).toBeDefined();
    expect(errs({ lastName: "" }).lastName).toBeDefined();
  });
  it("validates email when present", () => {
    expect(errs({ email: "nope" }).email).toBeDefined();
    expect(errs({ email: "a@b.co" }).email).toBeUndefined();
  });
  it("validates date of birth", () => {
    expect(errs({ dateOfBirth: "1970-02-30" }).dateOfBirth).toBeDefined();
    expect(errs({ dateOfBirth: "2999-01-01" }).dateOfBirth).toBeDefined();
    expect(errs({ dateOfBirth: "1970-02-01" }).dateOfBirth).toBeUndefined();
  });
  it("rejects unknown status and letters in phone", () => {
    expect(errs({ status: "VIP" }).status).toBeDefined();
    expect(errs({ phone: "call me" }).phone).toBeDefined();
  });
});

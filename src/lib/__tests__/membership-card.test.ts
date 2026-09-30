import { describe, expect, it } from "vitest";
import { isBarcodeSafe, normalizeMemberNumber } from "@/lib/membership-card";

describe("normalizeMemberNumber", () => {
  it("pads whole numbers to six digits", () => {
    expect(normalizeMemberNumber("123")).toBe("000123");
    expect(normalizeMemberNumber("000123")).toBe("000123");
    expect(normalizeMemberNumber(" 000007\n")).toBe("000007");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "abc", "12a", "1234567", "12 34", "-5", null, undefined]) expect(normalizeMemberNumber(bad as string)).toBeNull();
  });
});

describe("isBarcodeSafe", () => {
  it("allows plain codes only", () => {
    expect(isBarcodeSafe("000123")).toBe(true);
    expect(isBarcodeSafe("A-1")).toBe(true);
    for (const bad of ["", "<svg>", "a b", "x".repeat(21)]) expect(isBarcodeSafe(bad)).toBe(false);
  });
});

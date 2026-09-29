import { describe, expect, it } from "vitest";
import { addCopiesSchema, addTitleSchema, copyEditSchema, zodErrors } from "@/lib/validation";

const copies = { format: "VHS", categoryId: "c1", quantity: "10", replacementCost: "19.99" };
const title = { ...copies, title: "Terminator 2: Judgment Day", year: "1991", director: "", runtime: "137", genres: "Action, Sci-Fi", cast: "", rating: "R", overview: "", tmdbId: "280", posterPath: "/abc.jpg" };
const errs = (schema: typeof addTitleSchema | typeof addCopiesSchema, v: object) => {
  const r = schema.safeParse(v);
  return r.success ? {} : zodErrors(r.error);
};

describe("addCopiesSchema", () => {
  it("accepts valid input", () => expect(addCopiesSchema.safeParse(copies).success).toBe(true));
  it("rejects zero, negative, fractional and huge quantities", () => {
    for (const q of ["0", "-1", "2.5", "101", "", "abc"]) expect(errs(addCopiesSchema, { ...copies, quantity: q }).quantity).toBeDefined();
  });
  it("rejects negative replacement cost", () => expect(errs(addCopiesSchema, { ...copies, replacementCost: "-5" }).replacementCost).toMatch(/NEGATIVE/));
  it("rejects unknown format", () => expect(errs(addCopiesSchema, { ...copies, format: "BETAMAX" }).format).toBeDefined());
});

describe("addTitleSchema", () => {
  it("accepts a TMDB-populated title", () => expect(addTitleSchema.safeParse(title).success).toBe(true));
  it("requires a title", () => expect(errs(addTitleSchema, { ...title, title: " " }).title).toBeDefined());
  it("validates year and runtime", () => {
    expect(errs(addTitleSchema, { ...title, year: "91" }).year).toBeDefined();
    expect(errs(addTitleSchema, { ...title, runtime: "0" }).runtime).toBeDefined();
    expect(errs(addTitleSchema, { ...title, year: "", runtime: "" })).toEqual({});
  });
  it("rejects malicious poster paths and bad tmdb ids", () => {
    expect(errs(addTitleSchema, { ...title, posterPath: "//evil.com/x.jpg" }).posterPath).toBeDefined();
    expect(errs(addTitleSchema, { ...title, posterPath: "https://evil.com/x.jpg" }).posterPath).toBeDefined();
    expect(errs(addTitleSchema, { ...title, tmdbId: "12abc" }).tmdbId).toBeDefined();
  });
});

describe("copyEditSchema", () => {
  const edit = { status: "AVAILABLE", condition: "GOOD", categoryId: "c1", barcode: "", replacementCost: "10", notes: "" };
  it("accepts valid edit", () => expect(copyEditSchema.safeParse(edit).success).toBe(true));
  it("does not allow setting RENTED manually", () => expect(copyEditSchema.safeParse({ ...edit, status: "RENTED" }).success).toBe(false));
  it("restricts barcode characters", () => expect(copyEditSchema.safeParse({ ...edit, barcode: "a b;" }).success).toBe(false));
});

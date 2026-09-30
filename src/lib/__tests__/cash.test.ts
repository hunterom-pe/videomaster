import { describe, expect, it } from "vitest";
import { changeDueCents, parseTender, quickTenders, resolveTender } from "@/lib/cash";

describe("parseTender", () => {
  it("parses dollars", () => {
    expect(parseTender("20")).toBe(2000);
    expect(parseTender(" $20.5 ")).toBe(2050);
    expect(parseTender("0.07")).toBe(7);
    expect(parseTender("")).toBeNull();
    expect(parseTender(undefined)).toBeNull();
  });
  it("rejects junk and huge amounts", () => {
    for (const bad of ["abc", "-5", "1.234", "1e3", "100000", "5."]) expect(parseTender(bad)).toBeNaN();
  });
});

describe("quickTenders", () => {
  it("offers exact, next dollar and covering bills", () => {
    expect(quickTenders(437)).toEqual([437, 500, 1000, 2000, 5000]);
    expect(quickTenders(1200)).toEqual([1200, 2000, 5000, 10000]);
    expect(quickTenders(500)).toEqual([500, 1000, 2000, 5000, 10000]);
  });
});

describe("resolveTender", () => {
  it("ignores non-cash and zero totals", () => {
    expect(resolveTender("CREDIT_CARD", 500, "20")).toEqual({ ok: true, tenderedCents: null });
    expect(resolveTender("CASH", 0, "20")).toEqual({ ok: true, tenderedCents: null });
  });
  it("blank means exact cash", () => expect(resolveTender("CASH", 437, "")).toEqual({ ok: true, tenderedCents: 437 }));
  it("accepts enough cash and computes change", () => {
    const r = resolveTender("CASH", 437, "5");
    expect(r).toEqual({ ok: true, tenderedCents: 500 });
    expect(changeDueCents(437, 500)).toBe(63);
  });
  it("rejects short and invalid amounts", () => {
    expect(resolveTender("CASH", 437, "4.36")).toMatchObject({ ok: false });
    expect(resolveTender("CASH", 437, "x")).toMatchObject({ ok: false });
  });
});

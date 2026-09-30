import { describe, expect, it } from "vitest";
import { resolveBalanceAmount, resolvePaidNow } from "@/lib/balance";

describe("resolvePaidNow", () => {
  it("blank pays everything", () => expect(resolvePaidNow(450, "")).toEqual({ ok: true, paidCents: 450, unpaidCents: 0 }));
  it("splits partial payments", () => {
    expect(resolvePaidNow(450, "1.5")).toEqual({ ok: true, paidCents: 150, unpaidCents: 300 });
    expect(resolvePaidNow(450, "0")).toEqual({ ok: true, paidCents: 0, unpaidCents: 450 });
  });
  it("rejects overpay and junk", () => {
    expect(resolvePaidNow(450, "4.51")).toMatchObject({ ok: false });
    expect(resolvePaidNow(450, "abc")).toMatchObject({ ok: false });
  });
});

describe("resolveBalanceAmount", () => {
  it("blank = whole balance", () => expect(resolveBalanceAmount(700, "")).toEqual({ ok: true, cents: 700 }));
  it("accepts partial, rejects zero/over/junk", () => {
    expect(resolveBalanceAmount(700, "2")).toEqual({ ok: true, cents: 200 });
    expect(resolveBalanceAmount(700, "0")).toMatchObject({ ok: false });
    expect(resolveBalanceAmount(700, "7.01")).toMatchObject({ ok: false });
    expect(resolveBalanceAmount(700, "x")).toMatchObject({ ok: false });
    expect(resolveBalanceAmount(0, "")).toMatchObject({ ok: false });
  });
});

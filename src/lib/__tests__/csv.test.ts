import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralizes spreadsheet formulas in text", () => {
    for (const bad of ["=1+1", "+cmd", "-cmd", "@SUM(A1)", "\tx"]) expect(csvCell(bad).startsWith("'")).toBe(true);
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
  });
  it("leaves numbers, negatives, dates, booleans and blanks alone", () => {
    expect(csvCell(-1.5)).toBe("-1.5");
    expect(csvCell({ toString: () => "-12.00", toFixed: () => "" })).toBe("-12.00");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(csvCell(true)).toBe("TRUE");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("writes a BOM, header and CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });
});

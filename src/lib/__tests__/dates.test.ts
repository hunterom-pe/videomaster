import { describe, expect, it } from "vitest";
import { parseDay } from "@/lib/dates";

describe("parseDay", () => {
  it("parses valid dates to UTC midnight", () => expect(parseDay("1996-09-30")?.toISOString()).toBe("1996-09-30T00:00:00.000Z"));
  it("rejects malformed and impossible dates", () => {
    for (const s of ["", "96-09-30", "1996-9-3", "1996-02-30", "1996-13-01", "abcd-ef-gh", "1996-09-30x"]) expect(parseDay(s)).toBeNull();
  });
  it("accepts leap day only in leap years", () => {
    expect(parseDay("2024-02-29")).not.toBeNull();
    expect(parseDay("2023-02-29")).toBeNull();
  });
});

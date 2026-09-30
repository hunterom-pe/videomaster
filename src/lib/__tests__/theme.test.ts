import { describe, expect, it } from "vitest";
import { THEMES, nextTheme, parseTheme, themeLabel } from "@/lib/theme";

describe("theme", () => {
  it("falls back to DOS blue for missing or unknown cookies", () => {
    for (const bad of [undefined, null, "", "purple", "BLUE", "<script>"]) expect(parseTheme(bad as string)).toBe("blue");
  });
  it("accepts every defined theme", () => {
    for (const t of THEMES) expect(parseTheme(t.id)).toBe(t.id);
  });
  it("cycles through all themes and wraps around", () => {
    const seen = [];
    let t = parseTheme("blue");
    for (let i = 0; i < THEMES.length; i++) { seen.push(t); t = nextTheme(t); }
    expect(new Set(seen).size).toBe(THEMES.length);
    expect(t).toBe("blue");
    expect(themeLabel("green")).toBe("PHOSPHOR GREEN");
  });
});

import { describe, expect, it } from "vitest";
import { FUNCTION_KEYS, keyForPath, pathForKey } from "@/lib/function-keys";

describe("function keys", () => {
  it("follows the spec numbering (F1 rent, F2 return, F3 customers, F4 inventory, F5 concessions, F6 reports)", () => {
    expect(pathForKey({ key: "F1" })).toBe("/rent");
    expect(pathForKey({ key: "F2" })).toBe("/return");
    expect(pathForKey({ key: "F3" })).toBe("/customers");
    expect(pathForKey({ key: "F4" })).toBe("/inventory");
    expect(pathForKey({ key: "F5" })).toBe("/concessions");
    expect(pathForKey({ key: "F6" })).toBe("/reports");
  });
  it("never intercepts modified keys or non-mapped keys", () => {
    for (const m of ["ctrlKey", "altKey", "metaKey", "shiftKey"] as const) expect(pathForKey({ key: "F5", [m]: true })).toBeNull();
    for (const k of ["F10", "F11", "F12", "Enter", "a", "Escape"]) expect(pathForKey({ key: k })).toBeNull();
  });
  it("has unique keys/paths and labels map back", () => {
    expect(new Set(FUNCTION_KEYS.map((k) => k.key)).size).toBe(FUNCTION_KEYS.length);
    expect(new Set(FUNCTION_KEYS.map((k) => k.path)).size).toBe(FUNCTION_KEYS.length);
    expect(keyForPath("/reports")).toBe("F6");
    expect(keyForPath("/nope")).toBe("");
  });
});

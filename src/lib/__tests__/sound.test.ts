import { describe, expect, it } from "vitest";
import { SOUNDS, parseSoundEnabled, schedule } from "@/lib/sound";

describe("sound definitions", () => {
  it("every sound is short, audible and in a sensible pitch range", () => {
    for (const [name, notes] of Object.entries(SOUNDS)) {
      const s = schedule(notes);
      const end = s[s.length - 1].start + s[s.length - 1].dur;
      expect(end, name).toBeLessThan(0.6);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThan(80);
        expect(n.freq).toBeLessThan(4000);
        expect(n.ms).toBeGreaterThan(20);
      }
    }
  });
  it("schedules notes one after another with gaps", () => {
    const s = schedule(SOUNDS.warn);
    expect(s[0].start).toBe(0);
    expect(s[1].start).toBeCloseTo(0.11 + 0.07, 5);
  });
});

describe("parseSoundEnabled", () => {
  it("is on by default and off only for an explicit 'off'", () => {
    expect(parseSoundEnabled(undefined)).toBe(true);
    expect(parseSoundEnabled(null)).toBe(true);
    expect(parseSoundEnabled("on")).toBe(true);
    expect(parseSoundEnabled("garbage")).toBe(true);
    expect(parseSoundEnabled("off")).toBe(false);
  });
});

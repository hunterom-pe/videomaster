// Retro sound effects, synthesized with the Web Audio API (no audio files). The note definitions are pure data so they
// can be tested; `playSound` only works in the browser and silently does nothing elsewhere or when sound is off.
// The preference lives in a cookie (default ON); browsers only allow audio after the first click/tap on the page, so
// a sound that fires before any interaction is simply skipped.

export type SoundName = "beep" | "ding" | "buzz" | "warn";
export type Note = { freq: number; ms: number; type: OscillatorType; gapMs?: number };

export const SOUNDS: Record<SoundName, Note[]> = {
  beep: [{ freq: 1800, ms: 70, type: "square" }], // item added / scanned
  ding: [{ freq: 880, ms: 90, type: "triangle", gapMs: 10 }, { freq: 1320, ms: 200, type: "triangle" }], // transaction complete
  buzz: [{ freq: 140, ms: 280, type: "sawtooth" }], // error
  warn: [{ freq: 660, ms: 110, type: "square", gapMs: 70 }, { freq: 660, ms: 110, type: "square" }], // warning
};

export const SOUND_COOKIE = "vm_sound";
export const parseSoundEnabled = (raw: string | null | undefined): boolean => raw !== "off"; // default ON

/** Start time (seconds from now) and duration of each note in a sound. */
export function schedule(notes: Note[]): { start: number; dur: number; note: Note }[] {
  let t = 0;
  return notes.map((note) => {
    const item = { start: t, dur: note.ms / 1000, note };
    t += note.ms / 1000 + (note.gapMs ?? 0) / 1000;
    return item;
  });
}

const VOLUME = 0.07; // quiet: this is a beep, not an alarm
const MIN_GAP_MS = 250; // several alerts appearing together play one sound
let enabled = true;
let ctx: AudioContext | null = null;
let lastPlayedAt = 0;
let unlocked = false;

export const isSoundEnabled = () => enabled;
export function setSoundEnabled(on: boolean, persist = false) {
  enabled = on;
  if (persist && typeof document !== "undefined") document.cookie = `${SOUND_COOKIE}=${on ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call from a user gesture so the browser lets later sounds play. */
export function unlockAudio() {
  unlocked = true;
  const c = audio();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  const now = Date.now();
  if (name !== "buzz" && now - lastPlayedAt < MIN_GAP_MS) return;
  // Creating an AudioContext before any user activation only produces a console warning: don't, just skip.
  const active = unlocked || (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive === true);
  if (!active) return;
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  if (c.state !== "running") return; // still locked: skip quietly
  lastPlayedAt = now;
  const t0 = c.currentTime + 0.01;
  for (const { start, dur, note } of schedule(SOUNDS[name])) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(VOLUME, t0 + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur); // short fade avoids clicks
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}

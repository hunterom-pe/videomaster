"use client";

import { useState } from "react";
import { playSound, setSoundEnabled, unlockAudio } from "@/lib/sound";

/** Sound effects on/off. The choice is remembered in a cookie (default: on). */
export function SoundToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  function toggle() {
    const next = !on;
    setSoundEnabled(next, true);
    setOn(next);
    if (next) { unlockAudio(); setTimeout(() => playSound("beep"), 30); } // confirmation beep
  }
  return (
    <button type="button" className="vm-btn small vm-toggle sound" onClick={toggle} aria-pressed={on} aria-label={`Sound effects: ${on ? "on" : "off"}. Activate to turn ${on ? "off" : "on"}.`}>
      [ SOUND: {on ? "ON" : "OFF"} ]
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { playSound, setSoundEnabled, unlockAudio, type SoundName } from "@/lib/sound";

/**
 * Mounted once in the root layout. Plays sounds for things that appear on screen or are clicked, driven by markup:
 *   data-sound="beep"            -> plays when the element (or a child) is clicked
 *   data-sound-on-show="ding"    -> plays once when the element appears (page load or later)
 *   .vm-alert without an attribute -> "warn"
 * Audio unlocks on the first click, tap or key press (browser rule).
 */
export function SoundEngine({ initialEnabled }: { initialEnabled: boolean }) {
  useEffect(() => {
    setSoundEnabled(initialEnabled);
    const seen = new WeakSet<Element>();

    const announce = (root: ParentNode) => {
      const els = [...root.querySelectorAll<HTMLElement>("[data-sound-on-show], .vm-alert")];
      if (root instanceof HTMLElement && (root.matches("[data-sound-on-show], .vm-alert"))) els.unshift(root);
      // the most important sound wins when several things appear together
      const order: SoundName[] = ["buzz", "ding", "warn", "beep"];
      let best: SoundName | null = null;
      for (const el of els) {
        if (seen.has(el)) continue;
        seen.add(el);
        const name = (el.dataset.soundOnShow as SoundName | undefined) ?? (el.classList.contains("vm-alert") ? "warn" : undefined);
        if (name && (best === null || order.indexOf(name) < order.indexOf(best))) best = name;
      }
      if (best) playSound(best);
    };

    const onPointer = (e: Event) => {
      unlockAudio();
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-sound]");
      if (el && e.type === "click" && !el.hasAttribute("disabled")) playSound(el.dataset.sound as SoundName);
    };
    const events = ["pointerdown", "keydown", "click"] as const;
    events.forEach((t) => document.addEventListener(t, onPointer, true));

    announce(document);
    const observer = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof HTMLElement && announce(n));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      events.forEach((t) => document.removeEventListener(t, onPointer, true));
      observer.disconnect();
    };
  }, [initialEnabled]);
  return null;
}

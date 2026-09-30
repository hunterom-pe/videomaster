"use client";

import { useState } from "react";
import { THEME_COOKIE, nextTheme, parseTheme, themeLabel, type ThemeId } from "@/lib/theme";

/** Cycles DOS BLUE -> PHOSPHOR GREEN -> LIGHT. Applies instantly and remembers the choice in a cookie. */
export function ThemeToggle({ initial }: { initial: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(initial);
  function cycle() {
    const next = nextTheme(parseTheme(theme));
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" className="vm-btn small" onClick={cycle} aria-label={`Color theme: ${themeLabel(theme)}. Activate to change.`}>
      [ THEME: {themeLabel(theme)} ]
    </button>
  );
}

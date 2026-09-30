// Color themes. Pure (client + server). The choice lives in a cookie so the server can render the right theme on the
// first paint (no flash); the CSS variables for each theme are in globals.css.

export const THEMES = [
  { id: "blue", label: "DOS BLUE" },
  { id: "green", label: "PHOSPHOR GREEN" },
  { id: "light", label: "LIGHT" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_COOKIE = "vm_theme";
export const DEFAULT_THEME: ThemeId = "blue";

export const parseTheme = (raw: string | null | undefined): ThemeId => THEMES.find((t) => t.id === raw)?.id ?? DEFAULT_THEME;

/** The theme after `current` (wraps around). */
export const nextTheme = (current: ThemeId): ThemeId => THEMES[(THEMES.findIndex((t) => t.id === current) + 1) % THEMES.length].id;

export const themeLabel = (id: ThemeId) => THEMES.find((t) => t.id === id)!.label;

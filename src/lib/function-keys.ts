// Optional F1-F9 shortcuts (spec §28). Pure, so the mapping is testable and shared with the menu labels.
export const FUNCTION_KEYS = [
  { key: "F1", path: "/rent", label: "RENT VIDEO" },
  { key: "F2", path: "/return", label: "RETURN VIDEO" },
  { key: "F3", path: "/customers", label: "CUSTOMERS" },
  { key: "F4", path: "/inventory", label: "MOVIE INVENTORY" },
  { key: "F5", path: "/concessions", label: "CONCESSIONS" },
  { key: "F6", path: "/reports", label: "REPORTS" },
  { key: "F7", path: "/overdue", label: "OVERDUE RENTALS" },
  { key: "F8", path: "/transactions", label: "TRANSACTIONS" },
  { key: "F9", path: "/settings", label: "STORE SETTINGS" },
] as const;

export const keyForPath = (path: string): string => FUNCTION_KEYS.find((k) => k.path === path)?.key ?? "";

/** The screen a keypress should open, or null. Modified keys (Ctrl/Alt/Meta/Shift + F-key) are never touched. */
export function pathForKey(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return null;
  return FUNCTION_KEYS.find((k) => k.key === e.key)?.path ?? null;
}

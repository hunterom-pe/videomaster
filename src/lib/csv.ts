// CSV building (pure). Safe for spreadsheets: text that begins with = + - @ (or a tab/CR) would be run as a formula
// by Excel/Sheets, so such TEXT is prefixed with an apostrophe. Numbers and dates are written as plain values.

type Cell = string | number | boolean | Date | null | undefined | { toString(): string; toFixed?: unknown };

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let text: string;
  if (typeof v === "string") text = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  else if (v instanceof Date) text = v.toISOString();
  else if (typeof v === "boolean") text = v ? "TRUE" : "FALSE";
  else text = v.toString(); // numbers and Prisma Decimals: never neutralized (negative amounts stay numeric)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel-friendly: UTF-8 BOM, CRLF line endings. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

"use client";

export function PrintButton() {
  return (
    <button type="button" className="vm-btn" onClick={() => window.print()}>
      [ PRINT ]
    </button>
  );
}

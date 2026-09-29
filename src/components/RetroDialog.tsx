"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Retro confirmation dialog rendered as a real modal: focus moves into it, Tab is trapped inside,
 * Escape cancels, and focus returns to the control that opened it. Put `data-autofocus` on the
 * button that should receive initial focus (defaults to the first button).
 */
export function RetroDialog({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  const titleId = useId();

  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusables = () => [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    (root.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? root).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
      } else if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return e.preventDefault();
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="vm-overlay no-print">
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="vm-dialog" tabIndex={-1}>
        <h2 id={titleId} className="vm-yellow vm-center">{title}</h2>
        <hr className="vm-thin-rule" />
        {children}
      </div>
    </div>
  );
}

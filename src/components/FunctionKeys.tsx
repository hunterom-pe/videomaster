"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { pathForKey } from "@/lib/function-keys";

/** Optional F1-F9 shortcuts. Mounted only when the store enables them; never touches modified keys. */
export function FunctionKeys() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // A modal dialog is open: leave the keyboard to it.
      if (document.querySelector('[role="alertdialog"]')) return;
      const path = pathForKey(e);
      if (!path) return;
      e.preventDefault(); // stops the browser job of this key (e.g. F5 refresh) while VideoMaster is focused
      router.push(path);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

"use client";

import { useState, useTransition } from "react";
import { startDemo } from "@/actions/auth";
import { ErrorBox } from "@/components/ErrorBox";

export function DemoButton() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div>
      {message && <ErrorBox message={message} />}
      <button
        type="button"
        className="vm-btn"
        disabled={pending}
        onClick={() => startTransition(async () => { const r = await startDemo(); if (r && !r.ok) setMessage(r.message); })}
      >
        {pending ? "BUILDING DEMO STORE..." : "[ TRY DEMO MODE ]"}
      </button>
      <p className="vm-hint">NO ACCOUNT NEEDED. YOU GET YOUR OWN PRIVATE STORE, FULLY STOCKED WITH VIDEOS, CUSTOMERS AND TRANSACTIONS. IT IS DELETED AFTER 24 HOURS.</p>
    </div>
  );
}

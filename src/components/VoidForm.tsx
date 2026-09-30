"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { voidTransactionAction } from "@/actions/transaction-ops";
import { ErrorBox } from "@/components/ErrorBox";
import { RetroDialog } from "@/components/RetroDialog";

export function VoidForm({ transactionId, number }: { transactionId: string; number: string }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const r = await voidTransactionAction(transactionId, { reason });
      if (r && !r.ok) {
        setConfirming(false);
        setMessage([r.message, ...Object.values(r.errors)].join(" "));
      }
    });
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); setMessage(""); if (reason.trim().length < 3) return setMessage("ENTER A REASON (AT LEAST 3 CHARACTERS)"); setConfirming(true); }} noValidate>
      {message && <ErrorBox message={message} />}
      <div className="vm-field" style={{ maxWidth: 480 }}>
        <label htmlFor="reason">REASON FOR VOID</label>
        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} autoComplete="off" />
      </div>
      <div className="vm-actions">
        <button type="submit" className="vm-btn danger" disabled={pending}>[ VOID TRANSACTION ]</button>
        <Link href={`/transactions/${transactionId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>
      {confirming && (
        <RetroDialog title="CONFIRM VOID" onCancel={() => setConfirming(false)}>
          <p className="vm-center">VOID TRANSACTION #{number}? THIS CANNOT BE UNDONE.</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn danger" onClick={go} disabled={pending}>[ YES, VOID ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)} data-autofocus>[ NO ]</button>
          </div>
        </RetroDialog>
      )}
    </form>
  );
}

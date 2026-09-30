"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { renewMembership } from "@/actions/customers";
import { CashTender } from "@/components/CashTender";
import { ErrorBox } from "@/components/Screen";
import { PAYMENT_METHODS } from "@/lib/validation";

export function RenewForm({ customerId, fee }: { customerId: string; fee: string }) {
  const [method, setMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const hasFee = Number(fee) > 0;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await renewMembership(customerId, method, tendered);
      if (r && !r.ok) setMessage([r.message, ...Object.values(r.errors)].join(" "));
    });
  }
  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      {hasFee && (
        <div className="vm-field" style={{ maxWidth: 320 }}>
          <label htmlFor="pay">PAYMENT METHOD</label>
          <select id="pay" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
        </div>
      )}
      {hasFee && <div style={{ maxWidth: 320 }}><CashTender method={method} totalCents={Math.round(Number(fee) * 100)} value={tendered} onChange={setTendered} /></div>}
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "PROCESSING..." : hasFee ? `[ COLLECT $${fee} AND RENEW ]` : "[ RENEW ]"}</button>
        <Link href={`/customers/${customerId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>
    </form>
  );
}

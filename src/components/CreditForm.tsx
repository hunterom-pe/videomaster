"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sellCreditAction } from "@/actions/credit";
import { CashTender } from "@/components/CashTender";
import { ErrorBox } from "@/components/ErrorBox";
import { RetroDialog } from "@/components/RetroDialog";
import { parseTender } from "@/lib/cash";
import { fmtMoney } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/validation";

const QUICK = [500, 1000, 2000, 5000];

export function CreditForm({ customerId, creditCents }: { customerId: string; creditCents: number }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const cents = parseTender(amount);
  const valid = cents !== null && !Number.isNaN(cents) && cents > 0;
  const tp = parseTender(tendered);

  function review(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!valid) return setMessage("ENTER THE AMOUNT OF CREDIT, SUCH AS 20 OR 20.00.");
    if (method === "CASH" && (Number.isNaN(tp) || (tp !== null && tp < (cents as number)))) return setMessage(Number.isNaN(tp) ? "CASH TENDERED MUST BE A DOLLAR AMOUNT." : `CASH TENDERED IS LESS THAN THE ${fmtMoney(cents as number)} DUE.`);
    setConfirming(true);
  }
  function go() {
    setConfirming(false);
    startTransition(async () => {
      const r = await sellCreditAction(customerId, { amount, paymentMethod: method, tendered });
      if (r && !r.ok) setMessage([r.message, ...Object.values(r.errors)].join(" "));
    });
  }

  return (
    <form onSubmit={review} noValidate>
      {message && <ErrorBox message={message} />}
      <dl className="vm-kv"><dt>CURRENT STORE CREDIT</dt><dd><strong>{fmtMoney(creditCents)}</strong></dd></dl>
      <div className="vm-grid" style={{ marginTop: 10 }}>
        <div className="vm-field">
          <label htmlFor="credit-amount">CREDIT TO ADD</label>
          <input id="credit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
          <div className="vm-actions" style={{ marginTop: 4 }} role="group" aria-label="Quick amounts">
            {QUICK.map((c) => <button key={c} type="button" className="vm-btn small" onClick={() => setAmount((c / 100).toFixed(2))}>[ {fmtMoney(c)} ]</button>)}
          </div>
          <span className="vm-hint">MAXIMUM $500.00 PER SALE</span>
        </div>
        <div className="vm-field">
          <label htmlFor="credit-method">CUSTOMER PAYS WITH</label>
          <select id="credit-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.filter((p) => p.value !== "STORE_CREDIT").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
        </div>
        <CashTender method={method} totalCents={valid ? (cents as number) : 0} value={tendered} onChange={setTendered} />
      </div>
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>[ REVIEW SALE ]</button>
        <Link href={`/customers/${customerId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>
      {confirming && valid && (
        <RetroDialog title="CONFIRM CREDIT SALE" onCancel={() => setConfirming(false)}>
          <dl className="vm-kv">
            <dt>CREDIT ADDED</dt><dd>{fmtMoney(cents as number)}</dd>
            <dt>NEW STORE CREDIT</dt><dd>{fmtMoney(creditCents + (cents as number))}</dd>
            <dt>PAYMENT</dt><dd>{PAYMENT_METHODS.find((p) => p.value === method)?.label}</dd>
            {method === "CASH" && <><dt>CASH TENDERED</dt><dd>{fmtMoney(tp ?? (cents as number))}</dd><dt>CHANGE DUE</dt><dd><strong>{fmtMoney((tp ?? (cents as number)) - (cents as number))}</strong></dd></>}
          </dl>
          <p className="vm-center">SELL THIS STORE CREDIT?</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={go} disabled={pending}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)} data-autofocus>[ NO ]</button>
          </div>
        </RetroDialog>
      )}
    </form>
  );
}

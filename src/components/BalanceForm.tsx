"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { payBalanceAction, waiveBalanceAction } from "@/actions/balance";
import { CashTender } from "@/components/CashTender";
import { CreditHint } from "@/components/CreditHint";
import { RetroDialog } from "@/components/RetroDialog";
import { ErrorBox } from "@/components/ErrorBox";
import { resolveBalanceAmount } from "@/lib/balance";
import { parseTender } from "@/lib/cash";
import { fmtMoney } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/validation";

export function BalanceForm({ customerId, balanceCents, canWaive, creditCents = 0 }: { customerId: string; balanceCents: number; canWaive: boolean; creditCents?: number }) {
  const [mode, setMode] = useState<"pay" | "waive">("pay");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const amt = resolveBalanceAmount(balanceCents, amount);
  const cents = amt.ok ? amt.cents : 0;
  const tp = parseTender(tendered);

  function review(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!amt.ok) return setMessage(amt.message);
    if (mode === "pay" && method === "STORE_CREDIT" && cents > creditCents) return setMessage(`NOT ENOUGH STORE CREDIT: ${fmtMoney(creditCents)} AVAILABLE, ${fmtMoney(cents)} DUE.`);
    if (mode === "waive" && reason.trim().length < 3) return setMessage("ENTER A REASON (AT LEAST 3 CHARACTERS)");
    if (mode === "pay" && method === "CASH" && (Number.isNaN(tp) || (tp !== null && tp < cents)))
      return setMessage(Number.isNaN(tp) ? "CASH TENDERED MUST BE A DOLLAR AMOUNT SUCH AS 20 OR 20.00." : `CASH TENDERED IS LESS THAN THE ${fmtMoney(cents)} DUE.`);
    setConfirming(true);
  }
  function go() {
    startTransition(async () => {
      const r = mode === "pay"
        ? await payBalanceAction(customerId, { amount, paymentMethod: method, tendered })
        : await waiveBalanceAction(customerId, { amount, reason });
      if (r && !r.ok) {
        setConfirming(false);
        setMessage([r.message, ...Object.values(r.errors)].join(" "));
      }
    });
  }

  return (
    <form onSubmit={review} noValidate>
      {message && <ErrorBox message={message} />}
      {canWaive && (
        <div className="vm-actions" style={{ marginTop: 0 }} role="group" aria-label="Action">
          <button type="button" className="vm-btn" aria-pressed={mode === "pay"} style={mode === "pay" ? { background: "var(--hover)", color: "var(--on-hover)" } : undefined} onClick={() => setMode("pay")}>[ TAKE PAYMENT ]</button>
          <button type="button" className="vm-btn" aria-pressed={mode === "waive"} style={mode === "waive" ? { background: "var(--hover)", color: "var(--on-hover)" } : undefined} onClick={() => setMode("waive")}>[ WAIVE BALANCE ]</button>
        </div>
      )}
      <div className="vm-grid" style={{ marginTop: 10 }}>
        <div className="vm-field">
          <label htmlFor="amount">{mode === "pay" ? "AMOUNT TO PAY" : "AMOUNT TO WAIVE"}</label>
          <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={(balanceCents / 100).toFixed(2)} autoComplete="off" />
          <span className="vm-hint">LEAVE BLANK FOR THE FULL BALANCE ({fmtMoney(balanceCents)})</span>
        </div>
        {mode === "pay" ? (
          <>
            <div className="vm-field">
              <label htmlFor="method">PAYMENT METHOD</label>
              <select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
              <CreditHint method={method} creditCents={creditCents} dueCents={cents} />
            </div>
            <CashTender method={method} totalCents={cents} value={tendered} onChange={setTendered} />
          </>
        ) : (
          <div className="vm-field wide">
            <label htmlFor="reason">REASON</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} autoComplete="off" />
          </div>
        )}
      </div>
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{mode === "pay" ? "[ REVIEW PAYMENT ]" : "[ REVIEW WAIVER ]"}</button>
        <Link href={`/customers/${customerId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>
      {confirming && (
        <RetroDialog title={mode === "pay" ? "CONFIRM PAYMENT" : "CONFIRM WAIVER"} onCancel={() => setConfirming(false)}>
          <dl className="vm-kv">
            <dt>{mode === "pay" ? "PAYING" : "WAIVING"}</dt><dd>{fmtMoney(cents)}</dd>
            <dt>BALANCE AFTER</dt><dd>{fmtMoney(balanceCents - cents)}</dd>
            {mode === "pay" && <><dt>PAYMENT</dt><dd>{PAYMENT_METHODS.find((p) => p.value === method)?.label}</dd></>}
            {mode === "pay" && method === "CASH" && <><dt>CASH TENDERED</dt><dd>{fmtMoney(tp ?? cents)}</dd><dt>CHANGE DUE</dt><dd><strong>{fmtMoney((tp ?? cents) - cents)}</strong></dd></>}
          </dl>
          <p className="vm-center">{mode === "pay" ? "TAKE THIS PAYMENT?" : "WAIVE THIS AMOUNT? IT CANNOT BE UNDONE."}</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={go} disabled={pending}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)} data-autofocus>[ NO ]</button>
          </div>
        </RetroDialog>
      )}
    </form>
  );
}

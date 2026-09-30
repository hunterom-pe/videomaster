"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { returnAll } from "@/actions/returns";
import { CashTender } from "@/components/CashTender";
import { RetroDialog } from "@/components/RetroDialog";
import { ErrorBox } from "@/components/Screen";
import { resolvePaidNow } from "@/lib/balance";
import { parseTender } from "@/lib/cash";
import { fmtMoney } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/validation";

export type ReturnAllRow = { id: string; title: string; copyNumber: string; dueLabel: string; days: number; lateCents: number };

export function ReturnAllForm({ customerId, rows }: { customerId: string; rows: ReturnAllRow[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, true])));
  const [waive, setWaive] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [paidNow, setPaidNow] = useState("");
  const [tendered, setTendered] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const chosen = rows.filter((r) => selected[r.id]);
  const calc = chosen.reduce((n, r) => n + r.lateCents, 0);
  const total = waive ? 0 : calc;
  const split = resolvePaidNow(total, paidNow);
  const paid = split.ok ? split.paidCents : total;
  const onAccount = split.ok ? split.unpaidCents : 0;
  const tp = parseTender(tendered);

  function review(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (chosen.length === 0) return setMessage("SELECT AT LEAST ONE VIDEO TO RETURN.");
    if (!split.ok) return setMessage(split.message);
    if (method === "CASH" && paid > 0 && (Number.isNaN(tp) || (tp !== null && tp < paid)))
      return setMessage(Number.isNaN(tp) ? "CASH TENDERED MUST BE A DOLLAR AMOUNT SUCH AS 20 OR 20.00." : `CASH TENDERED IS LESS THAN THE ${fmtMoney(paid)} DUE NOW.`);
    setConfirming(true);
  }
  function go() {
    setConfirming(false);
    startTransition(async () => {
      const r = await returnAll(customerId, { rentalIds: chosen.map((c) => c.id), waiveLate: waive, paymentMethod: method, paidNow, tendered });
      if (r && !r.ok) setMessage([r.message, ...Object.values(r.errors)].join(" "));
    });
  }

  return (
    <form onSubmit={review} noValidate>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>VIDEOS TO RETURN</legend>
        <div className="vm-actions" style={{ marginTop: 0 }}>
          <button type="button" className="vm-btn small" onClick={() => setSelected(Object.fromEntries(rows.map((r) => [r.id, true])))}>[ SELECT ALL ]</button>
          <button type="button" className="vm-btn small" onClick={() => setSelected({})}>[ SELECT NONE ]</button>
        </div>
        <div className="vm-tablewrap">
          <table className="vm-table" style={{ minWidth: 560 }}>
            <thead><tr><th scope="col">RETURN</th><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">DUE</th><th scope="col">LATE FEE</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`Return ${r.title}`} checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} /></td>
                  <td>{r.title}</td>
                  <td>{r.copyNumber}</td>
                  <td>{r.dueLabel}{r.days > 0 && <span className="vm-red"> ({r.days} DAY{r.days === 1 ? "" : "S"} LATE)</span>}</td>
                  <td>{r.lateCents > 0 ? fmtMoney(r.lateCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vm-hint">EVERY SELECTED VIDEO IS A NORMAL RETURN. FOR DAMAGED OR LOST VIDEOS, OR A REWIND FEE, USE THE SINGLE RETURN SCREEN.</p>
      </fieldset>

      <fieldset className="vm-section">
        <legend>FEES AND PAYMENT</legend>
        <dl className="vm-kv">
          <dt>VIDEOS</dt><dd>{chosen.length}</dd>
          <dt>LATE FEES (POLICY)</dt><dd>{fmtMoney(calc)}</dd>
          <dt>FEES DUE</dt><dd><strong>{fmtMoney(total)}</strong></dd>
        </dl>
        {calc > 0 && (
          <label className="vm-check">
            <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} />
            <span>WAIVE ALL LATE FEES</span>
          </label>
        )}
        {total > 0 && (
          <div className="vm-grid" style={{ marginTop: 10 }}>
            <div className="vm-field">
              <label htmlFor="pay">PAYMENT METHOD</label>
              <select id="pay" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
            </div>
            <div className="vm-field">
              <label htmlFor="paidnow">AMOUNT PAID NOW</label>
              <input id="paidnow" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder={(total / 100).toFixed(2)} autoComplete="off" />
              <span className={split.ok ? (onAccount > 0 ? "vm-yellow" : "vm-hint") : "vm-red"} aria-live="polite">
                {!split.ok ? split.message : onAccount > 0 ? `${fmtMoney(onAccount)} WILL BE PUT ON THE CUSTOMER'S ACCOUNT` : "LEAVE BLANK TO COLLECT THE FULL AMOUNT"}
              </span>
            </div>
            <CashTender method={method} totalCents={paid} value={tendered} onChange={setTendered} />
          </div>
        )}
      </fieldset>

      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>[ RETURN {chosen.length} VIDEO{chosen.length === 1 ? "" : "S"} ]</button>
        <Link href={`/customers/${customerId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>

      {confirming && (
        <RetroDialog title="CONFIRM RETURN" onCancel={() => setConfirming(false)}>
          <dl className="vm-kv">
            <dt>VIDEOS</dt><dd>{chosen.length}</dd>
            <dt>FEES DUE</dt><dd>{fmtMoney(total)}{waive && calc > 0 ? " (LATE FEES WAIVED)" : ""}</dd>
            {onAccount > 0 && (<><dt>PAID NOW</dt><dd>{fmtMoney(paid)}</dd><dt>ON ACCOUNT</dt><dd className="vm-yellow">{fmtMoney(onAccount)}</dd></>)}
            {method === "CASH" && paid > 0 && (<><dt>CASH TENDERED</dt><dd>{fmtMoney(tp ?? paid)}</dd><dt>CHANGE DUE</dt><dd><strong>{fmtMoney((tp ?? paid) - paid)}</strong></dd></>)}
          </dl>
          <p className="vm-center">RETURN THESE VIDEOS?</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={go} disabled={pending}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)} data-autofocus>[ NO ]</button>
          </div>
        </RetroDialog>
      )}
    </form>
  );
}

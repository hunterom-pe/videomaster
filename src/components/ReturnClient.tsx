"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { completeReturn } from "@/actions/returns";
import { ErrorBox } from "@/components/Screen";
import { fmtMoney, toCents } from "@/lib/pricing";
import { PAYMENT_METHODS, returnSchema, zodErrors } from "@/lib/validation";

type Outcome = "RETURNED" | "DAMAGED" | "LOST";

type Props = { rentalId: string; calculated: string; lostFee: string; damageFee: string; rewindFee: string; isVhs: boolean };

export function ReturnClient({ rentalId, calculated, lostFee, damageFee, rewindFee, isVhs }: Props) {
  const [outcome, setOutcome] = useState<Outcome>("RETURNED");
  const [lateFee, setLateFee] = useState(calculated);
  const [otherFee, setOtherFee] = useState("0.00");
  const [payment, setPayment] = useState("CASH");
  const [notRewound, setNotRewound] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const calcCents = toCents(calculated);
  const lateNum = Number(lateFee);
  const lateCents = outcome === "LOST" || !Number.isFinite(lateNum) ? 0 : toCents(lateNum);
  const otherNum = Number(otherFee);
  const otherCents = outcome === "RETURNED" || !Number.isFinite(otherNum) ? 0 : toCents(otherNum);
  const rewindCents = notRewound && outcome !== "LOST" && isVhs ? toCents(rewindFee) : 0;
  const total = lateCents + otherCents + rewindCents;

  function pick(next: Outcome) {
    const value = outcome === next ? "RETURNED" : next; // click again to undo
    setOutcome(value);
    setOtherFee(value === "LOST" ? lostFee : value === "DAMAGED" ? damageFee : "0.00");
    setErrors({});
    setMessage("");
  }

  function tryComplete() {
    const parsed = returnSchema.safeParse({ outcome, lateFee, otherFee, paymentMethod: payment, notRewound });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setMessage("PLEASE CORRECT THE FIELDS MARKED BELOW");
      return;
    }
    if (outcome !== "LOST" && lateCents > calcCents) {
      setErrors({ lateFee: `LATE FEE CANNOT EXCEED THE CALCULATED AMOUNT (${fmtMoney(calcCents)})` });
      setMessage("PLEASE CORRECT THE FIELDS MARKED BELOW");
      return;
    }
    setErrors({});
    setMessage("");
    setConfirming(true);
  }

  function complete() {
    setConfirming(false);
    startTransition(async () => {
      const r = await completeReturn(rentalId, { outcome, lateFee, otherFee, paymentMethod: payment, notRewound });
      if (r && !r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });
  }

  return (
    <div>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>FEES</legend>
        <div className="vm-grid">
          <div className="vm-field">
            <label htmlFor="late">LATE FEE TO CHARGE</label>
            <input id="late" type="text" inputMode="decimal" value={outcome === "LOST" ? "0.00" : lateFee} disabled={outcome === "LOST"}
              onChange={(e) => setLateFee(e.target.value)} aria-invalid={!!errors.lateFee} />
            <span className="vm-hint">CALCULATED: {fmtMoney(calcCents)}. REDUCE OR WAIVE WITH [ WAIVE FEE ]. {outcome === "LOST" ? "NO LATE FEE ON A LOST ITEM." : ""}</span>
            {errors.lateFee && <span className="vm-fielderr">{errors.lateFee}</span>}
          </div>
          {outcome !== "RETURNED" && (
            <div className="vm-field">
              <label htmlFor="other">{outcome === "LOST" ? "LOST-ITEM / REPLACEMENT FEE" : "DAMAGE FEE"}</label>
              <input id="other" type="text" inputMode="decimal" value={otherFee} onChange={(e) => setOtherFee(e.target.value)} aria-invalid={!!errors.otherFee} />
              {errors.otherFee && <span className="vm-fielderr">{errors.otherFee}</span>}
            </div>
          )}
          {isVhs && Number(rewindFee) > 0 && outcome !== "LOST" && (
            <div className="vm-field">
              <span className="vm-label">REWIND</span>
              <label className="vm-check">
                <input type="checkbox" checked={notRewound} onChange={(e) => setNotRewound(e.target.checked)} />
                <span>TAPE WAS NOT REWOUND (+{fmtMoney(toCents(rewindFee))})</span>
              </label>
            </div>
          )}
          <div className="vm-field">
            <label htmlFor="pay">PAYMENT METHOD</label>
            <select id="pay" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className="vm-hint">{total > 0 ? "SIMULATED — NO REAL PAYMENT IS PROCESSED" : "NO PAYMENT DUE"}</span>
          </div>
        </div>
        <dl className="vm-kv" style={{ marginTop: 10 }}>
          <dt>OUTCOME</dt><dd className={outcome === "RETURNED" ? "" : "vm-yellow"}>{outcome === "RETURNED" ? "NORMAL RETURN" : `*** COPY WILL BE MARKED ${outcome} ***`}</dd>
          <dt>TOTAL DUE</dt><dd><strong>{fmtMoney(total)}</strong></dd>
        </dl>
        <div className="vm-actions">
          <button type="button" className="vm-btn" onClick={tryComplete} disabled={pending}>[ COMPLETE RETURN ]</button>
          <button type="button" className="vm-btn" onClick={() => setLateFee("0.00")} disabled={outcome === "LOST" || calcCents === 0}>[ WAIVE FEE ]</button>
          <button type="button" className="vm-btn danger" aria-pressed={outcome === "DAMAGED"} onClick={() => pick("DAMAGED")}>[ DAMAGE{outcome === "DAMAGED" ? " ✓" : ""} ]</button>
          <button type="button" className="vm-btn danger" aria-pressed={outcome === "LOST"} onClick={() => pick("LOST")}>[ LOST{outcome === "LOST" ? " ✓" : ""} ]</button>
          <Link href="/return" className="vm-btn">[ CANCEL ]</Link>
        </div>
        <p className="vm-hint">[ DAMAGE ] AND [ LOST ] CHOOSE THE OUTCOME (CLICK AGAIN TO UNDO). NOTHING IS SAVED UNTIL [ COMPLETE RETURN ] IS CONFIRMED.</p>
      </fieldset>

      {confirming && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="dlg" style={{ border: "4px double var(--yellow)", background: "var(--bg)", padding: 16, maxWidth: 420, margin: "16px auto" }}>
          <h2 id="dlg" className="vm-yellow vm-center">CONFIRM RETURN</h2>
          <hr className="vm-thin-rule" />
          <dl className="vm-kv">
            <dt>OUTCOME</dt><dd>{outcome}</dd>
            {rewindCents > 0 && (<><dt>REWIND FEE</dt><dd>{fmtMoney(rewindCents)}</dd></>)}
            <dt>FEES DUE</dt><dd>{fmtMoney(total)}</dd>
            {total > 0 && (<><dt>PAYMENT</dt><dd>{PAYMENT_METHODS.find((p) => p.value === payment)?.label}</dd></>)}
          </dl>
          <p className="vm-center">COMPLETE RETURN?</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={complete} disabled={pending}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)}>[ NO ]</button>
          </div>
        </div>
      )}
    </div>
  );
}

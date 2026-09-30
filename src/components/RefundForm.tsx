"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { refundTransactionAction } from "@/actions/transaction-ops";
import { ErrorBox } from "@/components/ErrorBox";
import { RetroDialog } from "@/components/RetroDialog";
import { fmtMoney } from "@/lib/pricing";
import { refundTotals } from "@/lib/refunds";
import { PAYMENT_METHODS } from "@/lib/validation";

export type RefundFormProps = {
  transactionId: string;
  number: string;
  defaultMethod: string;
  merchandise: { id: string; sku: string; description: string; unitCents: number; remaining: number; taxable: boolean; canRestock: boolean }[];
  rentals: { id: string; label: string; cents: number; taxable: boolean; returned: boolean }[];
  fee: { label: string; cents: number } | null;
  originalTaxCents: number;
  originalTaxableBaseCents: number;
  remainingTaxCents: number;
};

export function RefundForm(p: RefundFormProps) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>(() => Object.fromEntries(p.merchandise.map((m) => [m.id, true])));
  const [rentalSel, setRentalSel] = useState<Record<string, boolean>>({});
  const [wholeFee, setWholeFee] = useState(false);
  const [method, setMethod] = useState(p.defaultMethod);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedMerch = p.merchandise.filter((m) => (qty[m.id] ?? 0) > 0);
  const selectedRentals = p.rentals.filter((r) => rentalSel[r.id]);

  const totals = useMemo(() => {
    const lines = [
      ...selectedMerch.map((m) => ({ cents: m.unitCents * qty[m.id], taxable: m.taxable })),
      ...selectedRentals.map((r) => ({ cents: r.cents, taxable: r.taxable })),
      ...(wholeFee && p.fee ? [{ cents: p.fee.cents, taxable: false }] : []),
    ];
    const isFinal =
      p.merchandise.every((m) => qty[m.id] === m.remaining) && p.rentals.every((r) => rentalSel[r.id]) && (!p.fee || wholeFee);
    return { count: lines.length, ...refundTotals(lines, { originalTaxCents: p.originalTaxCents, originalTaxableBaseCents: p.originalTaxableBaseCents, remainingTaxCents: p.remainingTaxCents, isFinalRefund: isFinal }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, rentalSel, wholeFee]);

  const setQ = (id: string, n: number, max: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));

  function review(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (totals.count === 0) return setMessage("SELECT AT LEAST ONE ITEM TO REFUND.");
    if (reason.trim().length < 3) return setMessage("ENTER A REASON (AT LEAST 3 CHARACTERS)");
    setConfirming(true);
  }
  function go() {
    startTransition(async () => {
      const r = await refundTransactionAction(p.transactionId, {
        reason, paymentMethod: method, wholeFee,
        merchandise: selectedMerch.map((m) => ({ itemId: m.id, qty: qty[m.id], restock: m.canRestock && !!restock[m.id] })),
        rentalIds: selectedRentals.map((r) => r.id),
      });
      if (r && !r.ok) {
        setConfirming(false);
        setMessage([r.message, ...Object.values(r.errors)].join(" "));
      }
    });
  }

  return (
    <form onSubmit={review} noValidate>
      {message && <ErrorBox message={message} />}

      {p.merchandise.length > 0 && (
        <fieldset className="vm-section">
          <legend>MERCHANDISE</legend>
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 560 }}>
              <thead><tr><th scope="col">ITEM</th><th scope="col">UNIT</th><th scope="col">REFUNDABLE</th><th scope="col">REFUND QTY</th><th scope="col">RESTOCK</th></tr></thead>
              <tbody>
                {p.merchandise.map((m) => (
                  <tr key={m.id}>
                    <td>{m.sku} {m.description.toUpperCase()}</td>
                    <td>{fmtMoney(m.unitCents)}</td>
                    <td>{m.remaining}</td>
                    <td>
                      <button type="button" className="vm-btn" aria-label={`Fewer ${m.description}`} onClick={() => setQ(m.id, (qty[m.id] ?? 0) - 1, m.remaining)}>[ - ]</button>{" "}
                      <span aria-live="polite">{qty[m.id] ?? 0}</span>{" "}
                      <button type="button" className="vm-btn" aria-label={`More ${m.description}`} onClick={() => setQ(m.id, (qty[m.id] ?? 0) + 1, m.remaining)}>[ + ]</button>
                    </td>
                    <td>
                      {m.canRestock ? (
                        <label><input type="checkbox" checked={!!restock[m.id]} onChange={(e) => setRestock((r) => ({ ...r, [m.id]: e.target.checked }))} /> BACK TO SHELF</label>
                      ) : <span className="vm-dim">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}

      {p.rentals.length > 0 && (
        <fieldset className="vm-section">
          <legend>RENTAL CHARGES</legend>
          <ul className="vm-plain">
            {p.rentals.map((r) => (
              <li key={r.id}>
                <label>
                  <input type="checkbox" checked={!!rentalSel[r.id]} onChange={(e) => setRentalSel((s) => ({ ...s, [r.id]: e.target.checked }))} /> {r.label} — {fmtMoney(r.cents)}
                  {!r.returned && <span className="vm-yellow"> (STILL OUT — RETURN IT SEPARATELY)</span>}
                </label>
              </li>
            ))}
          </ul>
          <p className="vm-hint">REFUNDING A RENTAL RETURNS THE MONEY ONLY. THE VIDEO&apos;S STATUS DOES NOT CHANGE.</p>
        </fieldset>
      )}

      {p.fee && (
        <fieldset className="vm-section">
          <legend>FEE</legend>
          <label><input type="checkbox" checked={wholeFee} onChange={(e) => setWholeFee(e.target.checked)} /> {p.fee.label} — {fmtMoney(p.fee.cents)}</label>
        </fieldset>
      )}

      <fieldset className="vm-section">
        <legend>REFUND DETAILS</legend>
        <div className="vm-field" style={{ maxWidth: 480 }}>
          <label htmlFor="reason">REASON</label>
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} autoComplete="off" />
        </div>
        <div className="vm-field" style={{ maxWidth: 320 }}>
          <label htmlFor="method">REFUND TO</label>
          <select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
        </div>
        <dl className="vm-kv">
          <dt>SUBTOTAL</dt><dd>{fmtMoney(totals.subtotal)}</dd>
          <dt>TAX</dt><dd>{fmtMoney(totals.tax)}</dd>
          <dt>REFUND TOTAL</dt><dd><strong>{fmtMoney(totals.total)}</strong></dd>
        </dl>
      </fieldset>

      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>[ REVIEW REFUND ]</button>
        <Link href={`/transactions/${p.transactionId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>

      {confirming && (
        <RetroDialog title="CONFIRM REFUND" onCancel={() => setConfirming(false)}>
          <dl className="vm-kv">
            <dt>ORIGINAL</dt><dd>#{p.number}</dd>
            <dt>REFUND TOTAL</dt><dd>{fmtMoney(totals.total)}</dd>
            <dt>REFUND TO</dt><dd>{PAYMENT_METHODS.find((m) => m.value === method)?.label}</dd>
          </dl>
          <p className="vm-center">ISSUE THIS REFUND?</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={go} disabled={pending}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)} data-autofocus>[ NO ]</button>
          </div>
        </RetroDialog>
      )}
    </form>
  );
}

"use client";

import { changeDueCents, parseTender, quickTenders } from "@/lib/cash";
import { fmtMoney } from "@/lib/pricing";

/** Cash tendered + live change due. Renders nothing unless the method is CASH and money is due. Blank = exact cash. */
export function CashTender({ method, totalCents, value, onChange, id = "tender" }: { method: string; totalCents: number; value: string; onChange: (v: string) => void; id?: string }) {
  if (method !== "CASH" || totalCents <= 0) return null;
  const tendered = parseTender(value);
  const invalid = Number.isNaN(tendered);
  const effective = tendered === null || invalid ? null : tendered;
  const change = effective === null ? null : changeDueCents(totalCents, effective);
  return (
    <div className="vm-field">
      <label htmlFor={id}>CASH TENDERED</label>
      <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={(totalCents / 100).toFixed(2)} autoComplete="off" aria-describedby={`${id}-hint`} />
      <div className="vm-actions" style={{ marginTop: 4 }} role="group" aria-label="Quick cash amounts">
        {quickTenders(totalCents).map((c, i) => (
          <button key={c} type="button" className="vm-btn small" onClick={() => onChange((c / 100).toFixed(2))}>{i === 0 ? "[ EXACT ]" : `[ ${fmtMoney(c)} ]`}</button>
        ))}
      </div>
      <span id={`${id}-hint`} className={invalid || (change !== null && change < 0) ? "vm-red" : "vm-yellow"} aria-live="polite">
        {invalid ? "ENTER A DOLLAR AMOUNT, E.G. 20 OR 20.00" : change === null ? "LEAVE BLANK FOR EXACT CASH" : change < 0 ? `SHORT BY ${fmtMoney(-change)}` : `CHANGE DUE: ${fmtMoney(change)}`}
      </span>
    </div>
  );
}

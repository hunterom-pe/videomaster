"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createCustomer, updateCustomer } from "@/actions/customers";
import { CashTender } from "@/components/CashTender";
import { ErrorBox } from "@/components/ErrorBox";
import { CUSTOMER_STATUSES, PAYMENT_METHODS, customerSchema, zodErrors, type CustomerFormValues } from "@/lib/validation";


export function CustomerForm({ customerId, initial, membershipFee }: { customerId?: string; initial: CustomerFormValues; membershipFee?: string }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (key: keyof CustomerFormValues, value: string | boolean) => setV((p) => ({ ...p, [key]: value }));
  const showFee = !customerId && !!membershipFee && Number(membershipFee) > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = customerSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setMessage("PLEASE CORRECT THE FIELDS MARKED BELOW");
      window.scrollTo({ top: 0 });
      return;
    }
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await (customerId ? updateCustomer(customerId, v) : createCustomer(v));
      if (result && !result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
        window.scrollTo({ top: 0 });
      }
    });
  }

  const field = (key: Exclude<keyof CustomerFormValues, "collectFee">, label: string, opts: { wide?: boolean; type?: string; hint?: string } = {}) => (
    <div className={`vm-field${opts.wide ? " wide" : ""}`}>
      <label htmlFor={key}>{label}</label>
      <input id={key} type={opts.type ?? "text"} value={v[key] ?? ""} onChange={(e) => set(key, e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-err` : undefined} />
      {opts.hint && <span className="vm-hint">{opts.hint}</span>}
      {errors[key] && <span id={`${key}-err`} className="vm-fielderr">{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>MEMBER INFORMATION</legend>
        <div className="vm-grid">
          {field("firstName", "FIRST NAME")}
          {field("lastName", "LAST NAME")}
          {field("phone", "PHONE", { type: "tel" })}
          {field("email", "E-MAIL (OPTIONAL)", { type: "text" })}
          {field("address", "ADDRESS", { wide: true })}
          {field("city", "CITY")}
          {field("region", "STATE")}
          {field("postalCode", "POSTAL CODE")}
          {field("dateOfBirth", "DATE OF BIRTH (OPTIONAL)", { hint: "YYYY-MM-DD" })}
          <div className="vm-field">
            <label htmlFor="status">ACCOUNT STATUS</label>
            <select id="status" value={v.status} onChange={(e) => set("status", e.target.value)}>
              {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.status && <span id="status-err" className="vm-fielderr">{errors.status}</span>}
          </div>
          <div className="vm-field wide">
            <label htmlFor="notes">NOTES</label>
            <textarea id="notes" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? "notes-err" : undefined} />
            {errors.notes && <span id="notes-err" className="vm-fielderr">{errors.notes}</span>}
          </div>
        </div>
      </fieldset>
      {showFee && (
        <fieldset className="vm-section">
          <legend>MEMBERSHIP FEE</legend>
          <div className="vm-grid">
            <div className="vm-field">
              <span className="vm-label">FEE</span>
              <label className="vm-check">
                <input type="checkbox" checked={v.collectFee ?? false} onChange={(e) => set("collectFee", e.target.checked)} />
                <span>COLLECT MEMBERSHIP FEE (${membershipFee})</span>
              </label>
              <span className="vm-hint">UNCHECK TO WAIVE THE FEE FOR THIS CUSTOMER</span>
            </div>
            {v.collectFee && (
              <div className="vm-field">
                <label htmlFor="paymentMethod">PAYMENT METHOD</label>
                <select id="paymentMethod" value={v.paymentMethod ?? "CASH"} onChange={(e) => set("paymentMethod", e.target.value)}>
                  {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {errors.paymentMethod && <span id="paymentMethod-err" className="vm-fielderr">{errors.paymentMethod}</span>}
              </div>
            )}
            {v.collectFee && (
              <div>
                <CashTender method={v.paymentMethod ?? "CASH"} totalCents={Math.round(Number(membershipFee) * 100)} value={v.tendered ?? ""} onChange={(t) => set("tendered", t)} />
                {errors.tendered && <span className="vm-fielderr">{errors.tendered}</span>}
              </div>
            )}
          </div>
        </fieldset>
      )}
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "SAVING..." : "[ SAVE CUSTOMER ]"}</button>
        <Link href={customerId ? `/customers/${customerId}` : "/customers"} className="vm-btn">[ CANCEL ]</Link>
      </div>
    </form>
  );
}

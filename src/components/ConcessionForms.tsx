"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addStock, createConcession, updateConcession } from "@/actions/concessions";
import { ErrorBox } from "@/components/Screen";
import { concessionSchema, zodErrors, type ConcessionFormValues } from "@/lib/validation";


export function ConcessionForm({ itemId, initial, categories }: { itemId?: string; initial: ConcessionFormValues; categories: { id: string; name: string }[] }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ConcessionFormValues>(k: K, val: ConcessionFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = concessionSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setMessage("PLEASE CORRECT THE FIELDS MARKED BELOW");
      window.scrollTo({ top: 0 });
      return;
    }
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const r = await (itemId ? updateConcession(itemId, v) : createConcession(v));
      if (r && !r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        window.scrollTo({ top: 0 });
      }
    });
  }

  const text = (k: "sku" | "name" | "retailPrice" | "costPrice" | "quantityOnHand" | "lowStockThreshold" | "barcode", label: string, opts: { hint?: string; disabled?: boolean; mode?: "decimal" | "numeric" } = {}) => (
    <div className="vm-field">
      <label htmlFor={k}>{label}</label>
      <input id={k} type="text" inputMode={opts.mode} value={v[k]} disabled={opts.disabled} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} />
      {opts.hint && <span className="vm-hint">{opts.hint}</span>}
      {errors[k] && <span id={`${k}-err`} className="vm-fielderr">{errors[k]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>ITEM</legend>
        <div className="vm-grid">
          {text("name", "ITEM NAME")}
          {text("sku", "SKU", itemId ? { disabled: true, hint: "SKU CANNOT BE CHANGED" } : { hint: "LEAVE BLANK TO ASSIGN AUTOMATICALLY (E.G. C001)" })}
          <div className="vm-field">
            <label htmlFor="categoryId">CATEGORY</label>
            <select id="categoryId" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-invalid={!!errors.categoryId} aria-describedby={errors.categoryId ? "categoryId-err" : undefined}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <span id="categoryId-err" className="vm-fielderr">{errors.categoryId}</span>}
          </div>
          {text("barcode", "BARCODE (OPTIONAL)")}
          {text("retailPrice", "RETAIL PRICE", { mode: "decimal" })}
          {text("costPrice", "COST (OPTIONAL)", { mode: "decimal" })}
          {text("quantityOnHand", "QUANTITY ON HAND", { mode: "numeric" })}
          {text("lowStockThreshold", "LOW-STOCK THRESHOLD", { mode: "numeric", hint: "WARN WHEN ON-HAND IS AT OR BELOW THIS" })}
          <div className="vm-field">
            <span className="vm-label">OPTIONS</span>
            <label className="vm-check"><input type="checkbox" checked={v.taxable} onChange={(e) => set("taxable", e.target.checked)} /><span>TAXABLE</span></label>
            <label className="vm-check"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /><span>ACTIVE (AVAILABLE FOR SALE)</span></label>
          </div>
        </div>
      </fieldset>
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "SAVING..." : "[ SAVE ITEM ]"}</button>
        <Link href="/concessions" className="vm-btn">[ CANCEL ]</Link>
      </div>
    </form>
  );
}

export function AddStockForm({ itemId }: { itemId: string }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await addStock(itemId, amount);
      if (r && !r.ok) setError(Object.values(r.errors)[0] ?? r.message);
    });
  }
  return (
    <form onSubmit={submit} className="vm-searchbar" noValidate>
      <div className="vm-field" style={{ flex: "0 1 220px" }}>
        <label htmlFor="stock">RECEIVE STOCK (ADD UNITS)</label>
        <input id="stock" type="text" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} aria-invalid={!!error} />
        {error && <span className="vm-fielderr">{error}</span>}
      </div>
      <button type="submit" className="vm-btn" disabled={pending}>{pending ? "ADDING..." : "[ ADD STOCK ]"}</button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createStore, updateStore } from "@/actions/store";
import { ErrorBox } from "@/components/Screen";
import {
  CURRENCIES,
  DEFAULT_CATEGORIES,
  FORMAT_OPTIONS,
  storeSchema,
  zodErrors,
  type StoreFormValues,
} from "@/lib/validation";

export const EMPTY_STORE: StoreFormValues = {
  name: "", number: "", address: "", city: "", region: "", postalCode: "", phone: "",
  managerName: "", slogan: "", currency: "USD", salesTaxPercent: "", storeYear: "",
  onlyMoviesUpToStoreYear: false, formats: ["VHS"], categories: DEFAULT_CATEGORIES,
};

export function StoreForm({ mode, initial }: { mode: "setup" | "settings"; initial: StoreFormValues }) {
  const [v, setV] = useState<StoreFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) => setV((p) => ({ ...p, [key]: value }));
  const setCat = (i: number, key: string, value: string) =>
    setV((p) => ({ ...p, categories: p.categories.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)) }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = storeSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setMessage("PLEASE CORRECT THE FIELDS MARKED BELOW");
      window.scrollTo({ top: 0 });
      return;
    }
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await (mode === "setup" ? createStore(v) : updateStore(v));
      if (result && !result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
        window.scrollTo({ top: 0 });
      }
    });
  }

  const text = (key: keyof StoreFormValues, label: string, opts: { hint?: string; wide?: boolean; type?: string; inputMode?: "decimal" | "numeric" } = {}) => (
    <div className={`vm-field${opts.wide ? " wide" : ""}`}>
      <label htmlFor={key}>{label}</label>
      <input id={key} type={opts.type ?? "text"} inputMode={opts.inputMode} value={v[key] as string}
        onChange={(e) => set(key, e.target.value as never)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-err` : undefined} />
      {opts.hint && <span className="vm-hint">{opts.hint}</span>}
      {errors[key] && <span id={`${key}-err`} className="vm-fielderr">{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}

      <fieldset className="vm-section">
        <legend>1. STORE INFORMATION</legend>
        <div className="vm-grid">
          {text("name", "STORE NAME")}
          {text("number", "STORE NUMBER", { hint: "E.G. 0147", inputMode: "numeric" })}
          {text("address", "ADDRESS", { wide: true })}
          {text("city", "CITY")}
          {text("region", "STATE / REGION")}
          {text("postalCode", "POSTAL CODE")}
          {text("phone", "PHONE NUMBER", { type: "tel" })}
          {text("managerName", "MANAGER / OWNER NAME")}
          {text("slogan", "SLOGAN (OPTIONAL)", { wide: true })}
          <div className="vm-field">
            <label htmlFor="currency">CURRENCY</label>
            <select id="currency" value={v.currency} onChange={(e) => set("currency", e.target.value)} aria-invalid={!!errors.currency}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.currency && <span className="vm-fielderr">{errors.currency}</span>}
          </div>
          {text("salesTaxPercent", "SALES TAX %", { hint: "E.G. 8.6 (0 FOR NONE)", inputMode: "decimal" })}
        </div>
        <p className="vm-hint">FICTIONAL INFORMATION IS PERFECTLY FINE.</p>
      </fieldset>

      <fieldset className="vm-section">
        <legend>2. STORE ERA</legend>
        <div className="vm-grid">
          {text("storeYear", "STORE YEAR (OPTIONAL)", { hint: "E.G. 1996. LEAVE BLANK FOR NONE.", inputMode: "numeric" })}
          <div className="vm-field">
            <span className="vm-label">MOVIE SEARCH</span>
            <label className="vm-check">
              <input type="checkbox" checked={v.onlyMoviesUpToStoreYear} disabled={v.storeYear.trim() === ""}
                onChange={(e) => set("onlyMoviesUpToStoreYear", e.target.checked)} />
              <span>ONLY SHOW MOVIES ON OR BEFORE STORE YEAR</span>
            </label>
            <span className="vm-hint">USED LATER BY MOVIE SEARCH. MAY BE TURNED OFF ANY TIME.</span>
          </div>
        </div>
      </fieldset>

      <fieldset className="vm-section">
        <legend>3. FORMATS CARRIED</legend>
        <div className="vm-checks">
          {FORMAT_OPTIONS.map((f) => (
            <label key={f.value} className="vm-check">
              <input type="checkbox" checked={v.formats.includes(f.value)}
                onChange={(e) => set("formats", e.target.checked ? [...v.formats, f.value] : v.formats.filter((x) => x !== f.value))} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        {errors.formats && <span className="vm-fielderr">{errors.formats}</span>}
      </fieldset>

      <fieldset className="vm-section">
        <legend>4. RENTAL CATEGORIES</legend>
        <div className="vm-tablewrap">
          <table className="vm-table">
            <thead>
              <tr>
                <th scope="col">CATEGORY NAME</th>
                <th scope="col">PRICE</th>
                <th scope="col">DAYS</th>
                <th scope="col">LATE FEE / DAY</th>
                <th scope="col"><span className="vm-hint">ACTION</span></th>
              </tr>
            </thead>
            <tbody>
              {v.categories.map((c, i) => {
                const e = (k: string) => errors[`categories.${i}.${k}`];
                const cell = (k: "name" | "rentalPrice" | "rentalDays" | "lateFeePerDay", label: string, mode?: "decimal" | "numeric") => (
                  <td>
                    <input aria-label={`${label} FOR CATEGORY ${i + 1}`} value={c[k]} inputMode={mode} type="text"
                      onChange={(ev) => setCat(i, k, ev.target.value)} aria-invalid={!!e(k)} />
                    {e(k) && <span className="vm-fielderr">{e(k)}</span>}
                  </td>
                );
                return (
                  <tr key={c.id ?? `new-${i}`}>
                    {cell("name", "NAME")}
                    {cell("rentalPrice", "PRICE", "decimal")}
                    {cell("rentalDays", "DAYS", "numeric")}
                    {cell("lateFeePerDay", "LATE FEE", "decimal")}
                    <td>
                      <button type="button" className="vm-btn small danger" disabled={v.categories.length <= 1}
                        aria-label={`REMOVE CATEGORY ${i + 1}`}
                        onClick={() => set("categories", v.categories.filter((_, idx) => idx !== i))}>[ REMOVE ]</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.categories && <span className="vm-fielderr">{errors.categories}</span>}
        <div className="vm-actions">
          <button type="button" className="vm-btn small" disabled={v.categories.length >= 20}
            onClick={() => set("categories", [...v.categories, { name: "", rentalPrice: "1.99", rentalDays: "3", lateFeePerDay: "1.00" }])}>
            [ ADD CATEGORY ]
          </button>
        </div>
        <p className="vm-hint">PRICES IN THE STORE CURRENCY. LATE FEES ARE CHARGED PER DAY OVERDUE. ALL VALUES CAN BE CHANGED LATER IN STORE SETTINGS.</p>
      </fieldset>

      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>
          {pending ? "SAVING..." : mode === "setup" ? "[ SAVE STORE ]" : "[ SAVE SETTINGS ]"}
        </button>
        {mode === "settings" && <Link href="/menu" className="vm-btn">[ CANCEL ]</Link>}
      </div>
    </form>
  );
}

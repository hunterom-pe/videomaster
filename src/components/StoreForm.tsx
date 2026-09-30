"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createStore, updateStore } from "@/actions/store";
import { ErrorBox } from "@/components/ErrorBox";
import { DEFAULT_TIMEZONE, TIMEZONES, isValidTimeZone } from "@/lib/tz";
import {
  CURRENCIES,
  FORMAT_OPTIONS,
  storeSchema,
  zodErrors,
  type StoreFormValues,
} from "@/lib/validation";


export function StoreForm({ mode, initial }: { mode: "setup" | "settings"; initial: StoreFormValues }) {
  const [v, setV] = useState<StoreFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loadSample, setLoadSample] = useState(false);
  const [pending, startTransition] = useTransition();

  // First-run setup: pre-select the browser's time zone (Arizona stays "America/Phoenix", i.e. no daylight saving).
  useEffect(() => {
    if (mode !== "setup") return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (detected && isValidTimeZone(detected)) setV((p) => (p.timezone === DEFAULT_TIMEZONE ? { ...p, timezone: detected } : p));
  }, [mode]);

  const set = <K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) => setV((p) => ({ ...p, [key]: value }));
  const setMerch = (i: number, key: "name" | "prefix", value: string) =>
    setV((p) => ({ ...p, concessionCategories: p.concessionCategories.map((c, idx) => (idx === i ? { ...c, [key]: key === "prefix" ? value.toUpperCase().slice(0, 1) : value } : c)) }));
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
      const result = await (mode === "setup" ? createStore(v, loadSample) : updateStore(v));
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

  const SECTIONS = [
    ["store", "STORE INFO"], ["tax", "TAX"], ["year", "STORE YEAR"], ["formats", "FORMATS"], ["categories", "PRICING & LATE FEES"],
    ["fees", "OPTIONAL FEES"], ["merch", "MERCHANDISE"], ["inventory", "INVENTORY"], ["membership", "MEMBERSHIP"], ["system", "SYSTEM"],
  ] as const;
  const savedCategories = v.categories.filter((c) => c.id);

  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}

      <nav aria-label="Jump to a settings section" className="vm-jumpnav">
        <span className="vm-label">JUMP TO:</span>
        {SECTIONS.map(([id, label]) => <a key={id} href={`#sec-${id}`} className="vm-btn small">{label}</a>)}
      </nav>

      <fieldset className="vm-section" id="sec-store">
        <legend>STORE INFORMATION</legend>
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
            <select id="currency" value={v.currency} onChange={(e) => set("currency", e.target.value)} aria-invalid={!!errors.currency} aria-describedby={errors.currency ? "currency-err" : undefined}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.currency && <span id="currency-err" className="vm-fielderr">{errors.currency}</span>}
          </div>
          <div className="vm-field wide">
            <label htmlFor="timezone">TIME ZONE</label>
            <select id="timezone" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} aria-invalid={!!errors.timezone} aria-describedby={errors.timezone ? "timezone-err" : undefined}>
              {!TIMEZONES.some((z) => z.value === v.timezone) && <option value={v.timezone}>{v.timezone.toUpperCase()}</option>}
              {TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
            <span className="vm-hint">DECIDES WHEN &quot;TODAY&quot; STARTS FOR DUE DATES, LATE FEES, OVERDUE AND REPORTS. ARIZONA DOES NOT OBSERVE DAYLIGHT SAVING TIME.</span>
            {errors.timezone && <span id="timezone-err" className="vm-fielderr">{errors.timezone}</span>}
          </div>
        </div>
        <p className="vm-hint">FICTIONAL INFORMATION IS PERFECTLY FINE.</p>
      </fieldset>

      <fieldset className="vm-section" id="sec-tax">
        <legend>TAX SETTINGS</legend>
        <div className="vm-grid">
          {text("salesTaxPercent", "SALES TAX %", { hint: "E.G. 8.6 (0 FOR NONE). APPLIES TO RENTALS AND MERCHANDISE MARKED TAXABLE", inputMode: "decimal" })}
        </div>
      </fieldset>

      <fieldset className="vm-section" id="sec-year">
        <legend>STORE YEAR</legend>
        <div className="vm-grid">
          {text("storeYear", "STORE YEAR (OPTIONAL)", { hint: "E.G. 1996. LEAVE BLANK FOR NONE.", inputMode: "numeric" })}
          <div className="vm-field">
            <span className="vm-label">MOVIE SEARCH</span>
            <label className="vm-check">
              <input type="checkbox" checked={v.onlyMoviesUpToStoreYear} disabled={v.storeYear.trim() === ""}
                onChange={(e) => set("onlyMoviesUpToStoreYear", e.target.checked)} />
              <span>ONLY SHOW MOVIES ON OR BEFORE STORE YEAR</span>
            </label>
            <span className="vm-hint">USED BY MOVIE SEARCH WHEN ADDING TITLES. MAY BE TURNED OFF ANY TIME.</span>
          </div>
        </div>
      </fieldset>

      <fieldset className="vm-section" id="sec-formats">
        <legend>FORMATS CARRIED</legend>
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
        {mode === "settings" && savedCategories.length > 0 && v.formats.length > 0 && (
          <>
            <hr className="vm-thin-rule" />
            <p className="vm-hint">DEFAULT RENTAL CATEGORY PER FORMAT: PRESELECTED WHEN YOU ADD COPIES OF THAT FORMAT. TO PRICE A FORMAT DIFFERENTLY, CREATE A CATEGORY BELOW (E.G. &quot;DVD NEW RELEASE&quot;) AND CHOOSE IT HERE.</p>
            <div className="vm-grid">
              {FORMAT_OPTIONS.filter((f) => v.formats.includes(f.value)).map((f) => (
                <div key={f.value} className="vm-field">
                  <label htmlFor={`fmtdef-${f.value}`}>DEFAULT CATEGORY FOR {f.label}</label>
                  <select id={`fmtdef-${f.value}`} value={v.formatDefaults[f.value] ?? ""} onChange={(e) => set("formatDefaults", { ...v.formatDefaults, [f.value]: e.target.value })}>
                    <option value="">(FIRST CATEGORY IN THE LIST)</option>
                    {savedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
        {mode === "setup" && <p className="vm-hint">AFTER SETUP YOU CAN CHOOSE A DEFAULT RENTAL CATEGORY FOR EACH FORMAT IN STORE SETTINGS.</p>}
      </fieldset>

      <fieldset className="vm-section" id="sec-categories">
        <legend>RENTAL PRICING, CATEGORIES &amp; LATE FEES</legend>
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
                      onChange={(ev) => setCat(i, k, ev.target.value)} aria-invalid={!!e(k)} aria-describedby={e(k) ? `cat-${i}-${k}-err` : undefined} />
                    {e(k) && <span id={`cat-${i}-${k}-err`} className="vm-fielderr">{e(k)}</span>}
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

      <fieldset className="vm-section" id="sec-fees">
        <legend>OPTIONAL FEES</legend>
        <div className="vm-grid">
          {text("rewindFee", "REWIND FEE", { hint: "CHARGED AT RETURN IF A VHS IS NOT REWOUND. 0 = NONE", inputMode: "decimal" })}
          {text("damageFee", "DAMAGE FEE", { hint: "SUGGESTED WHEN A VIDEO IS RETURNED DAMAGED. 0 = NONE", inputMode: "decimal" })}
          {text("lostItemFee", "LOST-ITEM FEE", { hint: "ADDED TO THE REPLACEMENT COST WHEN A VIDEO IS LOST. 0 = NONE", inputMode: "decimal" })}
        </div>
        <p className="vm-hint">LATE FEES ARE SET PER RENTAL CATEGORY ABOVE. ALL FEES ARE OPTIONAL AND CAN BE CHANGED ANY TIME.</p>
      </fieldset>

      <fieldset className="vm-section" id="sec-merch">
        <legend>CONCESSION CATEGORIES</legend>
        <div className="vm-tablewrap">
          <table className="vm-table" style={{ minWidth: 420 }}>
            <thead>
              <tr><th scope="col">CATEGORY NAME</th><th scope="col">SKU LETTER</th><th scope="col"><span className="vm-hint">ACTION</span></th></tr>
            </thead>
            <tbody>
              {v.concessionCategories.map((c, i) => {
                const e = (k: string) => errors[`concessionCategories.${i}.${k}`];
                return (
                  <tr key={c.id ?? `new-merch-${i}`}>
                    <td>
                      <input aria-label={`NAME FOR MERCHANDISE CATEGORY ${i + 1}`} type="text" value={c.name} onChange={(ev) => setMerch(i, "name", ev.target.value)}
                        aria-invalid={!!e("name")} aria-describedby={e("name") ? `merch-${i}-name-err` : undefined} />
                      {e("name") && <span id={`merch-${i}-name-err`} className="vm-fielderr">{e("name")}</span>}
                    </td>
                    <td>
                      <input aria-label={`SKU LETTER FOR MERCHANDISE CATEGORY ${i + 1}`} type="text" value={c.prefix} maxLength={1} style={{ maxWidth: 90 }}
                        onChange={(ev) => setMerch(i, "prefix", ev.target.value)} aria-invalid={!!e("prefix")} aria-describedby={e("prefix") ? `merch-${i}-prefix-err` : undefined} />
                      {e("prefix") && <span id={`merch-${i}-prefix-err`} className="vm-fielderr">{e("prefix")}</span>}
                    </td>
                    <td>
                      <button type="button" className="vm-btn small danger" disabled={v.concessionCategories.length <= 1} aria-label={`REMOVE MERCHANDISE CATEGORY ${i + 1}`}
                        onClick={() => set("concessionCategories", v.concessionCategories.filter((_, idx) => idx !== i))}>[ REMOVE ]</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.concessionCategories && <span className="vm-fielderr">{errors.concessionCategories}</span>}
        <div className="vm-actions">
          <button type="button" className="vm-btn small" disabled={v.concessionCategories.length >= 20}
            onClick={() => set("concessionCategories", [...v.concessionCategories, { name: "", prefix: "" }])}>[ ADD CATEGORY ]</button>
        </div>
        <p className="vm-hint">GROUPS MERCHANDISE ON THE CONCESSIONS AND SALE SCREENS. THE SKU LETTER STARTS AUTOMATIC SKUS (C001, C002...). A CATEGORY THAT HAS ITEMS IS RETIRED, NOT DELETED, WHEN REMOVED.</p>
      </fieldset>

      <fieldset className="vm-section" id="sec-inventory">
        <legend>INVENTORY SETTINGS</legend>
        <div className="vm-grid">
          {text("replacementFee", "DEFAULT REPLACEMENT COST", { hint: "PREFILLED WHEN YOU ADD NEW COPIES", inputMode: "decimal" })}
          {text("defaultLowStock", "DEFAULT LOW-STOCK THRESHOLD", { hint: "PREFILLED FOR NEW MERCHANDISE. WARN WHEN ON-HAND IS AT OR BELOW THIS", inputMode: "numeric" })}
        </div>
      </fieldset>

      <fieldset className="vm-section" id="sec-membership">
        <legend>MEMBERSHIP RULES</legend>
        <div className="vm-grid">
          {text("membershipFee", "MEMBERSHIP FEE", { hint: "COLLECTED WHEN A CUSTOMER JOINS AND ON RENEWAL. 0 = FREE", inputMode: "decimal" })}
          {text("membershipTermMonths", "MEMBERSHIP TERM (MONTHS)", { hint: "0 = MEMBERSHIP NEVER EXPIRES", inputMode: "numeric" })}
          {text("maxRentalsOut", "MAXIMUM VIDEOS OUT PER CUSTOMER", { hint: "0 = UNLIMITED. A MANAGER CAN OVERRIDE AT CHECKOUT", inputMode: "numeric" })}
        </div>
      </fieldset>

      <fieldset className="vm-section" id="sec-system">
        <legend>SYSTEM SETTINGS</legend>
        <div className="vm-grid">
          <div className="vm-field">
            <span className="vm-label">KEYBOARD</span>
            <label className="vm-check">
              <input type="checkbox" checked={v.functionKeys} onChange={(e) => set("functionKeys", e.target.checked)} />
              <span>ENABLE FUNCTION-KEY SHORTCUTS (F1-F9)</span>
            </label>
            <span className="vm-hint">F1 RENT · F2 RETURN · F3 CUSTOMERS · F4 INVENTORY · F5 CONCESSIONS · F6 REPORTS · F7 OVERDUE · F8 TRANSACTIONS · F9 SETTINGS. EVERYTHING ALSO WORKS BY CLICKING. WHEN ON, THESE KEYS NO LONGER DO THEIR BROWSER JOBS (E.G. F5 REFRESH) WHILE VIDEOMASTER IS OPEN.</span>
          </div>
          {text("receiptFooter", "RECEIPT CLOSING MESSAGE", { hint: "PRINTED AT THE BOTTOM OF EVERY RECEIPT. BLANK = THANK YOU!" })}
        </div>
      </fieldset>

      {mode === "setup" && (
        <fieldset className="vm-section" id="sec-sample">
          <legend>SAMPLE STORE DATA (OPTIONAL)</legend>
          <label className="vm-check">
            <input type="checkbox" checked={loadSample} onChange={(e) => setLoadSample(e.target.checked)} />
            <span>LOAD SAMPLE STORE DATA?</span>
          </label>
          <p className="vm-hint">
            FILLS THE STORE WITH A READY-TO-EXPLORE DEMO: 28 CLASSIC MOVIES ON VHS, FICTIONAL CUSTOMERS, CANDY/POPCORN/DRINKS,
            AND THREE WEEKS OF RENTALS, RETURNS, LATE FEES AND SALES (INCLUDING SOME OVERDUE VIDEOS). YOU CAN CLEAR IT ANY TIME
            FROM STORE SETTINGS. LEAVE UNCHECKED TO START WITH AN EMPTY STORE.
          </p>
        </fieldset>
      )}

      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>
          {pending ? (loadSample ? "BUILDING DEMO STORE..." : "SAVING...") : mode === "setup" ? "[ SAVE STORE ]" : "[ SAVE SETTINGS ]"}
        </button>
        {mode === "settings" && <Link href="/menu" className="vm-btn">[ CANCEL ]</Link>}
      </div>
    </form>
  );
}

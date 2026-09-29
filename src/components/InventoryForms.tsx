"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addCopies, addTitle, updateCopy } from "@/actions/inventory";
import { ErrorBox } from "@/components/Screen";
import {
  COPY_CONDITIONS, EDITABLE_COPY_STATUSES, addCopiesSchema, addTitleSchema, copyEditSchema, zodErrors,
  type AddCopiesValues, type AddTitleValues, type CopyEditValues,
} from "@/lib/validation";
import type { ActionState } from "@/lib/validation";
import type { ZodType } from "zod";

export type CategoryOption = { id: string; name: string; price: string; days: number };
export type FormatOption = { value: string; label: string };

/** Shared client-side submit flow: validate, call the server action, surface errors. */
function useSubmit<T>(schema: ZodType, values: T, action: (v: T) => Promise<ActionState>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const fail = (e: Record<string, string>, m: string) => {
    setErrors(e);
    setMessage(m);
    window.scrollTo({ top: 0 });
  };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) return fail(zodErrors(parsed.error), "PLEASE CORRECT THE FIELDS MARKED BELOW");
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const r = await action(values);
      if (r && !r.ok) fail(r.errors, r.message);
    });
  };
  return { errors, message, pending, submit };
}

const Err = ({ e, id }: { e?: string; id: string }) => (e ? <span id={`${id}-err`} className="vm-fielderr">{e}</span> : null);

function CopyFields({
  v, set, errors, formats, categories, onFormat,
}: {
  v: AddCopiesValues; set: (k: keyof AddCopiesValues, val: string) => void; errors: Record<string, string>;
  formats: FormatOption[]; categories: CategoryOption[]; onFormat: (format: string) => void;
}) {
  const cat = categories.find((c) => c.id === v.categoryId);
  return (
    <div className="vm-grid">
      <div className="vm-field">
        <label htmlFor="format">FORMAT</label>
        <select id="format" value={v.format} onChange={(e) => onFormat(e.target.value)} aria-invalid={!!errors.format} aria-describedby={errors.format ? "format-err" : undefined}>
          {formats.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <Err id="format" e={errors.format} />
      </div>
      <div className="vm-field">
        <label htmlFor="categoryId">RENTAL CATEGORY</label>
        <select id="categoryId" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-invalid={!!errors.categoryId} aria-describedby={errors.categoryId ? "categoryId-err" : undefined}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {cat && <span className="vm-hint">RENTAL PRICE ${cat.price} · RENTAL PERIOD {cat.days} DAY{cat.days === 1 ? "" : "S"} (SET IN STORE SETTINGS)</span>}
        <Err id="categoryId" e={errors.categoryId} />
      </div>
      <div className="vm-field">
        <label htmlFor="quantity">QUANTITY TO ADD</label>
        <input id="quantity" type="text" inputMode="numeric" value={v.quantity} onChange={(e) => set("quantity", e.target.value)} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? "quantity-err" : undefined} />
        <span className="vm-hint">ONE INDIVIDUAL COPY RECORD IS CREATED FOR EACH</span>
        <Err id="quantity" e={errors.quantity} />
      </div>
      <div className="vm-field">
        <label htmlFor="replacementCost">REPLACEMENT COST (EACH)</label>
        <input id="replacementCost" type="text" inputMode="decimal" value={v.replacementCost} onChange={(e) => set("replacementCost", e.target.value)} aria-invalid={!!errors.replacementCost} aria-describedby={errors.replacementCost ? "replacementCost-err" : undefined} />
        <Err id="replacementCost" e={errors.replacementCost} />
      </div>
    </div>
  );
}

export function AddTitleForm({ initial, formats, categories, formatDefaults = {} }: { initial: AddTitleValues; formats: FormatOption[]; categories: CategoryOption[]; formatDefaults?: Record<string, string> }) {
  const [v, setV] = useState(initial);
  const set = (k: keyof AddTitleValues, val: string) => setV((p) => ({ ...p, [k]: val }));
  // Choosing a format preselects that format's default rental category (if the store set one).
  const onFormat = (format: string) => setV((p) => ({ ...p, format, categoryId: formatDefaults[format] ?? p.categoryId }));
  const { errors, message, pending, submit } = useSubmit(addTitleSchema, v, addTitle);
  const text = (k: keyof AddTitleValues, label: string, wide = false, hint?: string) => (
    <div className={`vm-field${wide ? " wide" : ""}`}>
      <label htmlFor={k}>{label}</label>
      <input id={k} type="text" value={v[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} />
      {hint && <span className="vm-hint">{hint}</span>}
      <Err id={k} e={errors[k]} />
    </div>
  );
  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>TITLE INFORMATION (EDITABLE)</legend>
        <div className="vm-grid">
          {text("title", "TITLE", true)}
          {text("year", "YEAR")}
          {text("rating", "RATING", false, "E.G. PG-13")}
          {text("director", "DIRECTOR")}
          {text("runtime", "RUNTIME (MINUTES)")}
          {text("genres", "GENRES", true, "COMMA-SEPARATED")}
          {text("cast", "CAST", true, "COMMA-SEPARATED")}
          <div className="vm-field wide">
            <label htmlFor="overview">PLOT SUMMARY</label>
            <textarea id="overview" rows={4} value={v.overview} onChange={(e) => set("overview", e.target.value)} />
            <Err id="overview" e={errors.overview} />
          </div>
        </div>
      </fieldset>
      <fieldset className="vm-section">
        <legend>ADD TITLE TO INVENTORY</legend>
        <CopyFields v={v} set={set} errors={errors} formats={formats} categories={categories} onFormat={onFormat} />
        <Err id="tmdbId" e={errors.tmdbId ?? errors.posterPath} />
      </fieldset>
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "ADDING..." : "[ ADD TO STORE ]"}</button>
        <Link href="/inventory" className="vm-btn">[ CANCEL ]</Link>
      </div>
    </form>
  );
}

export function AddCopiesForm({ titleId, initial, formats, categories, formatDefaults = {} }: { titleId: string; initial: AddCopiesValues; formats: FormatOption[]; categories: CategoryOption[]; formatDefaults?: Record<string, string> }) {
  const [v, setV] = useState(initial);
  const set = (k: keyof AddCopiesValues, val: string) => setV((p) => ({ ...p, [k]: val }));
  const onFormat = (format: string) => setV((p) => ({ ...p, format, categoryId: formatDefaults[format] ?? p.categoryId }));
  const { errors, message, pending, submit } = useSubmit(addCopiesSchema, v, (x: AddCopiesValues) => addCopies(titleId, x));
  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      <CopyFields v={v} set={set} errors={errors} formats={formats} categories={categories} onFormat={onFormat} />
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "ADDING..." : "[ ADD ]"}</button>
      </div>
    </form>
  );
}

export function CopyForm({ copyId, titleId, initial, categories, locked }: { copyId: string; titleId: string; initial: CopyEditValues; categories: CategoryOption[]; locked: boolean }) {
  const [v, setV] = useState(initial);
  const set = (k: keyof CopyEditValues, val: string) => setV((p) => ({ ...p, [k]: val }));
  const { errors, message, pending, submit } = useSubmit(copyEditSchema, v, (x: CopyEditValues) => updateCopy(copyId, x));
  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} />}
      <div className="vm-grid">
        <div className="vm-field">
          <label htmlFor="status">STATUS</label>
          <select id="status" value={v.status} disabled={locked} onChange={(e) => set("status", e.target.value)}>
            {EDITABLE_COPY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {locked && <span className="vm-hint">COPY IS CURRENTLY RENTED. STATUS CHANGES AFTER IT IS RETURNED.</span>}
          <Err id="status" e={errors.status} />
        </div>
        <div className="vm-field">
          <label htmlFor="condition">CONDITION</label>
          <select id="condition" value={v.condition} onChange={(e) => set("condition", e.target.value)}>
            {COPY_CONDITIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Err id="condition" e={errors.condition} />
        </div>
        <div className="vm-field">
          <label htmlFor="categoryId">RENTAL CATEGORY</label>
          <select id="categoryId" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Err id="categoryId" e={errors.categoryId} />
        </div>
        <div className="vm-field">
          <label htmlFor="barcode">BARCODE (OPTIONAL)</label>
          <input id="barcode" type="text" value={v.barcode} onChange={(e) => set("barcode", e.target.value)} aria-invalid={!!errors.barcode} aria-describedby={errors.barcode ? "barcode-err" : undefined} />
          <Err id="barcode" e={errors.barcode} />
        </div>
        <div className="vm-field">
          <label htmlFor="replacementCost">REPLACEMENT COST</label>
          <input id="replacementCost" type="text" inputMode="decimal" value={v.replacementCost} onChange={(e) => set("replacementCost", e.target.value)} aria-invalid={!!errors.replacementCost} aria-describedby={errors.replacementCost ? "replacementCost-err" : undefined} />
          <Err id="replacementCost" e={errors.replacementCost} />
        </div>
        <div className="vm-field wide">
          <label htmlFor="notes">NOTES</label>
          <textarea id="notes" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          <Err id="notes" e={errors.notes} />
        </div>
      </div>
      <div className="vm-actions">
        <button type="submit" className="vm-btn" disabled={pending}>{pending ? "SAVING..." : "[ SAVE COPY ]"}</button>
        <Link href={`/inventory/${titleId}`} className="vm-btn">[ CANCEL ]</Link>
      </div>
    </form>
  );
}

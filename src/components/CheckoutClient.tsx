"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { checkout, findRentableCopies, type CartItem, type TitleHit } from "@/actions/rentals";
import { ErrorBox } from "@/components/Screen";
import { dueDate, fmtDate, fmtMoney, taxCents } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/validation";

type Props = {
  customerId: string;
  customerName: string;
  status: string;
  fees: string;
  needsOverride: boolean;
  canOverride: boolean;
  taxPercent: string;
};

export function CheckoutClient({ customerId, customerName, status, fees, needsOverride, canOverride, taxPercent }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TitleHit[]>([]);
  const [searchMsg, setSearchMsg] = useState("");
  const [payment, setPayment] = useState("CASH");
  const [override, setOverride] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const [paying, startPay] = useTransition();

  const subtotal = cart.reduce((n, i) => n + i.priceCents, 0);
  const tax = taxCents(cart.filter((i) => i.taxable).reduce((n, i) => n + i.priceCents, 0), taxPercent);
  const total = subtotal + tax;
  const now = new Date();

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    startSearch(async () => {
      const r = await findRentableCopies(query, cart.map((c) => c.copyId));
      setHits(r.hits);
      setSearchMsg(r.message ?? "");
    });
  }

  function add(item: CartItem) {
    setCart((c) => (c.some((x) => x.copyId === item.copyId) ? c : [...c, item]));
    setHits((hs) =>
      hs.map((h) => ({ ...h, groups: h.groups.map((g) => ({ ...g, copies: g.copies.filter((c) => c.copyId !== item.copyId), available: g.copies.some((c) => c.copyId === item.copyId) ? g.available - 1 : g.available })) })),
    );
    setError("");
  }

  const remove = () => {
    if (!selected) return;
    setCart((c) => c.filter((i) => i.copyId !== selected));
    setSelected(null);
  };

  function complete() {
    setConfirming(false);
    startPay(async () => {
      const r = await checkout(customerId, { copyIds: cart.map((c) => c.copyId), paymentMethod: payment, override });
      if (r && !r.ok) setError([r.message, ...Object.values(r.errors)].join(" "));
    });
  }

  function tryPay() {
    if (cart.length === 0) return setError("*** CART EMPTY *** ADD AT LEAST ONE VIDEO BEFORE TAKING PAYMENT.");
    if (needsOverride && !override) return setError(canOverride ? `*** ACCOUNT ${status} *** CHECK "MANAGER OVERRIDE" BELOW TO CONTINUE.` : `*** ACCOUNT ${status} *** MANAGER OVERRIDE REQUIRED.`);
    setError("");
    setConfirming(true);
  }

  return (
    <div>
      {error && <ErrorBox message={error} />}

      <fieldset className="vm-section">
        <legend>ADD RENTAL</legend>
        <form onSubmit={search} className="vm-searchbar" role="search">
          <div className="vm-field">
            <label htmlFor="rq">MOVIE TITLE, COPY ID OR BARCODE</label>
            <input id="rq" type="text" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
          <button type="submit" className="vm-btn" disabled={searching}>{searching ? "SEARCHING..." : "[ FIND ]"}</button>
        </form>
        {searchMsg && (
          <div className="vm-notice" role="status">
            {searchMsg}
            <div className="vm-hint">ONLY MOVIES ALREADY IN YOUR STORE INVENTORY CAN BE RENTED. <Link href="/inventory/add">ADD A TITLE FIRST</Link>.</div>
          </div>
        )}
        {hits.map((h) => (
          <div key={h.titleId} style={{ marginBottom: 10 }}>
            <div className="vm-cyan">{h.title.toUpperCase()}{h.year ? ` (${h.year})` : ""}</div>
            {h.groups.every((g) => g.available === 0) && <div className="vm-yellow">*** NO AVAILABLE COPIES *** ALL COPIES ARE CURRENTLY OUT OR UNAVAILABLE.</div>}
            {h.groups.filter((g) => g.available > 0).map((g) => (
              <div key={g.format} className="vm-actions" style={{ alignItems: "center", marginTop: 4 }}>
                <span style={{ minWidth: 120 }}>{g.format} · {g.available} AVAILABLE</span>
                <button type="button" className="vm-btn small" onClick={() => add(g.copies[0])}>
                  [ ADD {g.copies[0].copyNumber} · {fmtMoney(g.copies[0].priceCents)} ]
                </button>
                {g.copies.length > 1 && <span className="vm-hint">OR PICK:</span>}
                {g.copies.slice(1).map((c) => (
                  <button key={c.copyId} type="button" className="vm-btn small" onClick={() => add(c)}>{c.copyNumber}</button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="vm-section">
        <legend>CUSTOMER CHECKOUT</legend>
        <dl className="vm-kv">
          <dt>CUSTOMER</dt><dd>{customerName}</dd>
          <dt>ACCOUNT</dt><dd><span className={`vm-status ${status}`}>{status}</span></dd>
        </dl>
        {Number(fees) > 0 && <div className="vm-notice" role="status">OUTSTANDING BALANCE: ${fees}</div>}
        <hr className="vm-thin-rule" />
        <div className="vm-tablewrap">
          <table className="vm-table rows" style={{ minWidth: 520 }}>
            <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>CLICK AN ITEM TO SELECT IT, THEN [ REMOVE ITEM ]</caption>
            <thead><tr><th scope="col">ITEM</th><th scope="col">PRICE</th><th scope="col">DUE</th></tr></thead>
            <tbody>
              {cart.length === 0 && <tr><td colSpan={3} className="vm-dim">NO ITEMS. USE ADD RENTAL ABOVE.</td></tr>}
              {cart.map((i) => (
                <tr key={i.copyId} style={selected === i.copyId ? { background: "var(--cyan)", color: "var(--black)" } : undefined}>
                  <td>
                    <button type="button" className="vm-rowlink" aria-pressed={selected === i.copyId} onClick={() => setSelected(selected === i.copyId ? null : i.copyId)}
                      style={{ background: "none", border: 0, font: "inherit", color: "inherit", padding: 0, cursor: "pointer", textAlign: "left" }}>
                      {i.title.toUpperCase()} — {i.format} [{i.copyNumber}]
                    </button>
                  </td>
                  <td>{fmtMoney(i.priceCents)}</td>
                  <td>{fmtDate(dueDate(now, i.days))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <hr className="vm-thin-rule" />
        <dl className="vm-kv">
          <dt>RENTALS</dt><dd>{fmtMoney(subtotal)}</dd>
          <dt>TAX ({taxPercent}%)</dt><dd>{fmtMoney(tax)}</dd>
          <dt>TOTAL</dt><dd><strong>{fmtMoney(total)}</strong></dd>
        </dl>
        <div className="vm-grid" style={{ marginTop: 10 }}>
          <div className="vm-field">
            <label htmlFor="pay">PAYMENT METHOD</label>
            <select id="pay" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
          </div>
          {needsOverride && (
            <div className="vm-field">
              <span className="vm-label">MANAGER OVERRIDE</span>
              <label className="vm-check">
                <input type="checkbox" checked={override} disabled={!canOverride} onChange={(e) => setOverride(e.target.checked)} />
                <span>{canOverride ? `ALLOW RENTAL ON ${status} ACCOUNT` : "MANAGER OVERRIDE REQUIRED"}</span>
              </label>
            </div>
          )}
        </div>
        <div className="vm-actions">
          <button type="button" className="vm-btn" onClick={tryPay} disabled={paying}>[ TAKE PAYMENT ]</button>
          <button type="button" className="vm-btn" onClick={remove} disabled={!selected}>[ REMOVE ITEM ]</button>
          <Link href="/rent" className="vm-btn">[ CANCEL ]</Link>
        </div>
      </fieldset>

      {confirming && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="dlg" style={{ border: "4px double var(--yellow)", background: "var(--bg)", padding: 16, maxWidth: 420, margin: "16px auto" }}>
          <h2 id="dlg" className="vm-yellow vm-center">CONFIRM RENTAL</h2>
          <hr className="vm-thin-rule" />
          <dl className="vm-kv">
            <dt>CUSTOMER</dt><dd>{customerName}</dd>
            <dt>ITEMS</dt><dd>{cart.length}</dd>
            <dt>TOTAL</dt><dd>{fmtMoney(total)}</dd>
            <dt>PAYMENT</dt><dd>{PAYMENT_METHODS.find((p) => p.value === payment)?.label}</dd>
          </dl>
          <p className="vm-center">COMPLETE TRANSACTION?</p>
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="vm-btn" onClick={complete} disabled={paying}>[ YES ]</button>
            <button type="button" className="vm-btn" onClick={() => setConfirming(false)}>[ NO ]</button>
          </div>
        </div>
      )}
    </div>
  );
}


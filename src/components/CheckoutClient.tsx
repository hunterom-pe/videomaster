"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { checkout, findRentableCopies, findSaleItems, type CartItem, type SaleItem, type TitleHit } from "@/actions/rentals";
import { ErrorBox } from "@/components/Screen";
import { computeTotals, dueDate, fmtDate, fmtMoney } from "@/lib/pricing";
import { CONCESSION_CATEGORIES, PAYMENT_METHODS } from "@/lib/validation";

type Props = {
  customerId: string | null; // null = walk-in merchandise sale (no rentals)
  customerName: string;
  status: string;
  fees: string;
  restrictions: string[]; // reasons rentals need a manager override (account status, expired membership)
  activeOut: number; // videos this customer already has out
  maxOut: number; // store limit (0 = unlimited)
  canOverride: boolean;
  taxPercent: string;
};

type SaleLine = { item: SaleItem; qty: number };

const rentalKey = (id: string) => `rental:${id}`;
const saleKey = (id: string) => `sale:${id}`;
const rowStyle = (selected: boolean) => (selected ? { background: "var(--cyan)", color: "var(--black)" } : undefined);
const plainBtn = { background: "none", border: 0, font: "inherit", color: "inherit", padding: 0, cursor: "pointer", textAlign: "left" } as const;

export function CheckoutClient({ customerId, customerName, status, fees, restrictions, activeOut, maxOut, canOverride, taxPercent }: Props) {
  const [rentals, setRentals] = useState<CartItem[]>([]);
  const [sales, setSales] = useState<SaleLine[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TitleHit[]>([]);
  const [searchMsg, setSearchMsg] = useState("");

  const [saleQuery, setSaleQuery] = useState("");
  const [saleCat, setSaleCat] = useState("");
  const [saleHits, setSaleHits] = useState<SaleItem[]>([]);
  const [saleMsg, setSaleMsg] = useState("");
  const [saleLoaded, setSaleLoaded] = useState(false);

  const [payment, setPayment] = useState("CASH");
  const [override, setOverride] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const [searchingSale, startSaleSearch] = useTransition();
  const [paying, startPay] = useTransition();

  const totals = computeTotals(
    rentals.map((r) => ({ cents: r.priceCents, taxable: r.taxable })),
    sales.map((s) => ({ cents: s.item.priceCents * s.qty, taxable: s.item.taxable })),
    taxPercent,
  );
  const itemCount = rentals.length + sales.reduce((n, s) => n + s.qty, 0);
  const now = new Date();
  const limitReason = maxOut > 0 && activeOut + rentals.length > maxOut ? `RENTAL LIMIT ${maxOut} (${activeOut} ALREADY OUT)` : null;
  const reasons = rentals.length > 0 ? [...restrictions, ...(limitReason ? [limitReason] : [])] : [];
  const needsOverrideNow = reasons.length > 0;

  function searchRentals(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    startSearch(async () => {
      const r = await findRentableCopies(query, rentals.map((c) => c.copyId));
      setHits(r.hits);
      setSearchMsg(r.message ?? "");
    });
  }

  function loadSale(nextQuery: string, nextCat: string) {
    setSaleLoaded(true);
    startSaleSearch(async () => {
      const r = await findSaleItems(nextQuery, nextCat);
      setSaleHits(r.items);
      setSaleMsg(r.message ?? "");
    });
  }

  const addRental = (item: CartItem) => {
    setRentals((c) => (c.some((x) => x.copyId === item.copyId) ? c : [...c, item]));
    setHits((hs) => hs.map((h) => ({ ...h, groups: h.groups.map((g) => ({ ...g, available: g.copies.some((c) => c.copyId === item.copyId) ? g.available - 1 : g.available, copies: g.copies.filter((c) => c.copyId !== item.copyId) })) })));
    setError("");
  };

  const addSale = (item: SaleItem) => {
    setSales((cur) => {
      const found = cur.find((l) => l.item.itemId === item.itemId);
      if (!found) return [...cur, { item, qty: 1 }];
      if (found.qty >= item.onHand) {
        setError(`*** NOT ENOUGH STOCK *** ONLY ${item.onHand} ${item.name.toUpperCase()} ON HAND.`);
        return cur;
      }
      return cur.map((l) => (l.item.itemId === item.itemId ? { ...l, qty: l.qty + 1 } : l));
    });
    setError("");
  };

  const changeQty = (itemId: string, delta: number) =>
    setSales((cur) =>
      cur.flatMap((l) => {
        if (l.item.itemId !== itemId) return [l];
        const qty = l.qty + delta;
        if (qty <= 0) return [];
        if (qty > l.item.onHand) {
          setError(`*** NOT ENOUGH STOCK *** ONLY ${l.item.onHand} ${l.item.name.toUpperCase()} ON HAND.`);
          return [l];
        }
        return [{ ...l, qty }];
      }),
    );

  function removeSelected() {
    if (!selected) return;
    if (selected.startsWith("rental:")) setRentals((c) => c.filter((i) => rentalKey(i.copyId) !== selected));
    else setSales((c) => c.filter((l) => saleKey(l.item.itemId) !== selected));
    setSelected(null);
  }

  function tryPay() {
    if (itemCount === 0) return setError("*** CART EMPTY *** ADD AT LEAST ONE ITEM BEFORE TAKING PAYMENT.");
    if (needsOverrideNow && !override)
      return setError(canOverride ? `*** ${reasons.join("; ")} *** CHECK "MANAGER OVERRIDE" BELOW TO CONTINUE.` : `*** ${reasons.join("; ")} *** MANAGER OVERRIDE REQUIRED.`);
    setError("");
    setConfirming(true);
  }

  function complete() {
    setConfirming(false);
    startPay(async () => {
      const r = await checkout(customerId, {
        copyIds: rentals.map((c) => c.copyId),
        items: sales.map((l) => ({ itemId: l.item.itemId, quantity: l.qty })),
        paymentMethod: payment,
        override,
      });
      if (r && !r.ok) setError([r.message, ...Object.values(r.errors)].join(" "));
    });
  }

  return (
    <div>
      {error && <ErrorBox message={error} />}

      {customerId && (
        <fieldset className="vm-section">
          <legend>ADD RENTAL</legend>
          <form onSubmit={searchRentals} className="vm-searchbar" role="search">
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
                  <button type="button" className="vm-btn small" onClick={() => addRental(g.copies[0])}>[ ADD {g.copies[0].copyNumber} · {fmtMoney(g.copies[0].priceCents)} ]</button>
                  {g.copies.length > 1 && <span className="vm-hint">OR PICK:</span>}
                  {g.copies.slice(1).map((c) => <button key={c.copyId} type="button" className="vm-btn small" onClick={() => addRental(c)}>{c.copyNumber}</button>)}
                </div>
              ))}
            </div>
          ))}
        </fieldset>
      )}

      <fieldset className="vm-section">
        <legend>ADD SALE ITEM</legend>
        <div className="vm-actions" style={{ marginTop: 0 }} role="group" aria-label="Merchandise categories">
          <button type="button" className="vm-btn small" aria-pressed={saleCat === "" && saleLoaded} onClick={() => { setSaleCat(""); loadSale(saleQuery, ""); }}>[ ALL ]</button>
          {CONCESSION_CATEGORIES.map((c) => (
            <button key={c.value} type="button" className="vm-btn small" aria-pressed={saleCat === c.value}
              style={saleCat === c.value ? { background: "var(--cyan)" } : undefined}
              onClick={() => { setSaleCat(c.value); loadSale(saleQuery, c.value); }}>[ {c.label} ]</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); loadSale(saleQuery, saleCat); }} className="vm-searchbar" role="search" style={{ marginTop: 10 }}>
          <div className="vm-field">
            <label htmlFor="sq">ITEM NAME, SKU OR BARCODE</label>
            <input id="sq" type="text" value={saleQuery} onChange={(e) => setSaleQuery(e.target.value)} autoComplete="off" />
          </div>
          <button type="submit" className="vm-btn" disabled={searchingSale}>{searchingSale ? "SEARCHING..." : "[ FIND ]"}</button>
        </form>
        {!saleLoaded && <p className="vm-hint">CLICK A CATEGORY OR [ FIND ] TO LIST MERCHANDISE.</p>}
        {saleMsg && <div className="vm-notice" role="status">{saleMsg}</div>}
        {saleHits.length > 0 && (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 480 }}>
              <thead><tr><th scope="col">SKU</th><th scope="col">ITEM</th><th scope="col">PRICE</th><th scope="col">ON HAND</th><th scope="col"><span className="vm-hint">ADD</span></th></tr></thead>
              <tbody>
                {saleHits.map((i) => (
                  <tr key={i.itemId}>
                    <td>{i.sku}</td><td>{i.name.toUpperCase()}</td><td>{fmtMoney(i.priceCents)}</td><td>{i.onHand}</td>
                    <td><button type="button" className="vm-btn small" onClick={() => addSale(i)} aria-label={`Add ${i.name}`}>[ ADD ]</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      <fieldset className="vm-section">
        <legend>{customerId ? "CUSTOMER CHECKOUT" : "MERCHANDISE SALE"}</legend>
        <dl className="vm-kv">
          <dt>CUSTOMER</dt><dd>{customerName}</dd>
          {customerId && (<><dt>ACCOUNT</dt><dd><span className={`vm-status ${status}`}>{status}</span></dd></>)}
        </dl>
        {Number(fees) > 0 && <div className="vm-notice" role="status">OUTSTANDING BALANCE: ${fees}</div>}
        <hr className="vm-thin-rule" />
        <div className="vm-tablewrap">
          <table className="vm-table rows" style={{ minWidth: 560 }}>
            <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>CLICK AN ITEM TO SELECT IT, THEN [ REMOVE ITEM ]</caption>
            <thead><tr><th scope="col">ITEM</th><th scope="col">PRICE</th><th scope="col">DUE / QTY</th></tr></thead>
            <tbody>
              {itemCount === 0 && <tr><td colSpan={3} className="vm-dim">{customerId ? "NO ITEMS. USE ADD RENTAL OR ADD SALE ITEM." : "NO ITEMS. USE ADD SALE ITEM."}</td></tr>}
              {rentals.map((i) => (
                <tr key={i.copyId} style={rowStyle(selected === rentalKey(i.copyId))}>
                  <td>
                    <button type="button" aria-pressed={selected === rentalKey(i.copyId)} style={plainBtn} onClick={() => setSelected(selected === rentalKey(i.copyId) ? null : rentalKey(i.copyId))}>
                      {i.title.toUpperCase()} — {i.format} [{i.copyNumber}]
                    </button>
                  </td>
                  <td>{fmtMoney(i.priceCents)}</td>
                  <td>{fmtDate(dueDate(now, i.days))}</td>
                </tr>
              ))}
              {sales.map((l) => (
                <tr key={l.item.itemId} style={rowStyle(selected === saleKey(l.item.itemId))}>
                  <td>
                    <button type="button" aria-pressed={selected === saleKey(l.item.itemId)} style={plainBtn} onClick={() => setSelected(selected === saleKey(l.item.itemId) ? null : saleKey(l.item.itemId))}>
                      {l.item.name.toUpperCase()} <span className="vm-dim">{l.item.sku}</span>
                    </button>
                  </td>
                  <td>{fmtMoney(l.item.priceCents * l.qty)}{l.qty > 1 ? ` (${l.qty} × ${fmtMoney(l.item.priceCents)})` : ""}</td>
                  <td>
                    <button type="button" className="vm-btn small" onClick={() => changeQty(l.item.itemId, -1)} aria-label={`Decrease ${l.item.name}`}>[ - ]</button>{" "}
                    <strong>{l.qty}</strong>{" "}
                    <button type="button" className="vm-btn small" onClick={() => changeQty(l.item.itemId, 1)} aria-label={`Increase ${l.item.name}`}>[ + ]</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <hr className="vm-thin-rule" />
        <dl className="vm-kv">
          <dt>RENTALS</dt><dd>{fmtMoney(totals.rentalCents)}</dd>
          <dt>MERCHANDISE</dt><dd>{fmtMoney(totals.merchCents)}</dd>
          <dt>TAX ({taxPercent}%)</dt><dd>{fmtMoney(totals.tax)}</dd>
          <dt>TOTAL</dt><dd><strong>{fmtMoney(totals.total)}</strong></dd>
        </dl>
        <div className="vm-grid" style={{ marginTop: 10 }}>
          <div className="vm-field">
            <label htmlFor="pay">PAYMENT METHOD</label>
            <select id="pay" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className="vm-hint">SIMULATED — NO REAL PAYMENT IS PROCESSED</span>
          </div>
          {needsOverrideNow && (
            <div className="vm-field">
              <span className="vm-label">MANAGER OVERRIDE</span>
              <label className="vm-check">
                <input type="checkbox" checked={override} disabled={!canOverride} onChange={(e) => setOverride(e.target.checked)} />
                <span>{canOverride ? `ALLOW RENTAL DESPITE: ${reasons.join("; ")}` : "MANAGER OVERRIDE REQUIRED"}</span>
              </label>
            </div>
          )}
        </div>
        <div className="vm-actions">
          <button type="button" className="vm-btn" onClick={tryPay} disabled={paying}>[ TAKE PAYMENT ]</button>
          <button type="button" className="vm-btn" onClick={removeSelected} disabled={!selected}>[ REMOVE ITEM ]</button>
          <Link href={customerId ? "/rent" : "/menu"} className="vm-btn">[ CANCEL ]</Link>
        </div>
      </fieldset>

      {confirming && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="dlg" style={{ border: "4px double var(--yellow)", background: "var(--bg)", padding: 16, maxWidth: 420, margin: "16px auto" }}>
          <h2 id="dlg" className="vm-yellow vm-center">{rentals.length > 0 ? "CONFIRM RENTAL" : "CONFIRM SALE"}</h2>
          <hr className="vm-thin-rule" />
          <dl className="vm-kv">
            <dt>CUSTOMER</dt><dd>{customerName}</dd>
            <dt>ITEMS</dt><dd>{itemCount}</dd>
            <dt>TOTAL</dt><dd>{fmtMoney(totals.total)}</dd>
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

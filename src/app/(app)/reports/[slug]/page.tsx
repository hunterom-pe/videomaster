import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportShell } from "@/components/ReportShell";
import { FORMAT_LABELS } from "@/lib/inventory";
import { stockState } from "@/lib/concessions";
import { fmtDate, fmtMoney } from "@/lib/pricing";
import { resolveDay, resolveRange } from "@/lib/report-range";
import { dailyActivity, inventorySummary, listOverdue, merchandiseInventory, popularRentals, revenue, topCustomers } from "@/lib/reports";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_LABELS } from "@/lib/transactions";
import type { MediaFormat, PaymentMethod } from "@/generated/prisma/client";

const REPORT_TITLES: Record<string, string> = {
  daily: "DAILY ACTIVITY", overdue: "OVERDUE RENTALS REPORT", inventory: "INVENTORY REPORT", popular: "POPULAR RENTALS",
  customers: "CUSTOMER ACTIVITY", merchandise: "MERCHANDISE INVENTORY", revenue: "REVENUE REPORT",
};
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: REPORT_TITLES[slug] ?? "REPORTS" };
}

type SP = { from?: string; to?: string; date?: string };
const Row = ({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) => (
  <><dt>{label}</dt><dd>{strong ? <strong>{value}</strong> : value}</dd></>
);

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { user, store } = await requireStore();
  const { slug } = await params;
  const sp = await searchParams;
  const tz = store.settings!.timezone;
  const base = { user: user.email, store: { name: store.name, number: store.number }, slug, tz };

  if (slug === "daily") {
    const d = resolveDay(sp.date, tz);
    const a = await dailyActivity(store.id, d.day, d.next);
    return (
      <ReportShell {...base} title="DAILY ACTIVITY" filter={{ kind: "day", day: d.dayStr }} notice={d.invalid ? "*** INVALID DATE IGNORED. SHOWING TODAY. ***" : undefined}>
        <fieldset className="vm-section">
          <legend>ACTIVITY FOR {d.dayStr}</legend>
          <dl className="vm-kv">
            <Row label="RENTALS" value={a.rentals} />
            <Row label="RETURNS" value={a.returns} />
            <Row label="MERCHANDISE SALES" value={`${a.merchandiseUnits} UNIT${a.merchandiseUnits === 1 ? "" : "S"} · ${fmtMoney(a.merchandiseCents)}`} />
            <Row label="RENTAL REVENUE" value={fmtMoney(a.rentalCents)} />
            <Row label="LATE FEES CHARGED" value={fmtMoney(a.lateFeeCents)} />
            <Row label="DAMAGE / LOST FEES" value={fmtMoney(a.otherFeeCents)} />
            <Row label="REWIND FEES" value={fmtMoney(a.rewindFeeCents)} />
            <Row label="MEMBERSHIP FEES" value={fmtMoney(a.membershipCents)} />
            <Row label="SALES TAX" value={fmtMoney(a.taxCents)} />
            <Row label="TOTAL REVENUE" value={fmtMoney(a.totalCents)} strong />
            <Row label="TRANSACTIONS" value={a.transactions} />
          </dl>
        </fieldset>
        <p className="vm-hint no-print">TOTAL REVENUE = ALL MONEY COLLECTED THAT DAY (INCLUDING TAX). <Link href={`/transactions?from=${d.dayStr}&to=${d.dayStr}`}>VIEW THE {a.transactions} TRANSACTION{a.transactions === 1 ? "" : "S"}</Link></p>
      </ReportShell>
    );
  }

  if (slug === "overdue") {
    const { rows, capped } = await listOverdue(store.id, tz);
    const total = rows.reduce((n, r) => n + r.feeCents, 0);
    return (
      <ReportShell {...base} title="OVERDUE RENTALS">
        {rows.length === 0 ? (
          <div className="vm-notice" role="status">*** NO OVERDUE RENTALS ***</div>
        ) : (
          <>
            <p><strong>{rows.length}</strong> OVERDUE · CURRENT LATE FEES <strong>{fmtMoney(total)}</strong>{capped ? " · FIRST 5,000 ONLY" : ""}</p>
            <div className="vm-tablewrap">
              <table className="vm-table" style={{ minWidth: 720 }}>
                <thead><tr><th scope="col">CUSTOMER</th><th scope="col">MOVIE</th><th scope="col">COPY</th><th scope="col">DUE DATE</th><th scope="col">DAYS OVERDUE</th><th scope="col">CURRENT LATE FEE</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rentalId}><td>{r.customerName}</td><td>{r.title.toUpperCase()}</td><td>{r.copyNumber}</td><td>{fmtDate(r.dueAt, tz)}</td><td>{r.daysLate}</td><td>{fmtMoney(r.feeCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportShell>
    );
  }

  if (slug === "inventory") {
    const inv = await inventorySummary(store.id, tz);
    const t = inv.totals;
    return (
      <ReportShell {...base} title="INVENTORY">
        <fieldset className="vm-section">
          <legend>SUMMARY</legend>
          <dl className="vm-kv">
            <Row label="TOTAL TITLES" value={inv.titles} />
            <Row label="TOTAL COPIES" value={t.total} strong />
            <Row label="AVAILABLE" value={t.available} />
            <Row label="RENTED" value={t.rented} />
            <Row label="OVERDUE" value={t.overdue} />
            <Row label="DAMAGED / REPAIR" value={t.damaged} />
            <Row label="LOST" value={t.lost} />
            <Row label="RETIRED (NOT COUNTED)" value={t.retired} />
          </dl>
        </fieldset>
        {inv.rows.length > 0 && (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 640 }}>
              <caption className="vm-hint" style={{ textAlign: "left" }}>BY FORMAT (RENTED INCLUDES OVERDUE)</caption>
              <thead><tr><th scope="col">FORMAT</th><th scope="col">TOTAL</th><th scope="col">AVAILABLE</th><th scope="col">RENTED</th><th scope="col">OVERDUE</th><th scope="col">DAMAGED</th><th scope="col">LOST</th></tr></thead>
              <tbody>
                {inv.rows.map((r) => (
                  <tr key={r.format}><td>{FORMAT_LABELS[r.format as MediaFormat]}</td><td>{r.total}</td><td>{r.available}</td><td>{r.rented}</td><td>{r.overdue}</td><td>{r.damaged}</td><td>{r.lost}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportShell>
    );
  }

  if (slug === "popular" || slug === "customers") {
    const r = resolveRange(sp.from, sp.to, 30, tz);
    const filter = { kind: "range" as const, from: r.fromStr, to: r.toStr };
    const notice = r.invalid ? "*** INVALID DATE IGNORED. USE YYYY-MM-DD. ***" : undefined;
    if (slug === "popular") {
      const rows = await popularRentals(store.id, r);
      return (
        <ReportShell {...base} title="POPULAR RENTALS" filter={filter} notice={notice}>
          {rows.length === 0 ? <div className="vm-notice" role="status">*** NO RENTALS IN THIS PERIOD ***</div> : (
            <div className="vm-tablewrap">
              <table className="vm-table" style={{ minWidth: 480 }}>
                <thead><tr><th scope="col">RANK</th><th scope="col">TITLE</th><th scope="col">YEAR</th><th scope="col">RENTALS</th></tr></thead>
                <tbody>
                  {rows.map((x, i) => <tr key={x.id}><td>{i + 1}</td><td><Link href={`/inventory/${x.id}`}>{x.title.toUpperCase()}</Link></td><td>{x.year ?? "—"}</td><td>{x.count}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </ReportShell>
      );
    }
    const rows = await topCustomers(store.id, r);
    return (
      <ReportShell {...base} title="CUSTOMER ACTIVITY" filter={filter} notice={notice}>
        {rows.length === 0 ? <div className="vm-notice" role="status">*** NO RENTALS IN THIS PERIOD ***</div> : (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 520 }}>
              <thead><tr><th scope="col">RANK</th><th scope="col">CUSTOMER</th><th scope="col">MEMBER #</th><th scope="col">RENTALS</th><th scope="col">RENTAL SPEND</th></tr></thead>
              <tbody>
                {rows.map((x, i) => <tr key={x.id}><td>{i + 1}</td><td><Link href={`/customers/${x.id}`}>{x.name}</Link></td><td>{x.member}</td><td>{x.count}</td><td>{fmtMoney(x.spentCents)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </ReportShell>
    );
  }

  if (slug === "merchandise") {
    const m = await merchandiseInventory(store.id);
    return (
      <ReportShell {...base} title="MERCHANDISE INVENTORY">
        <fieldset className="vm-section">
          <legend>SUMMARY</legend>
          <dl className="vm-kv">
            <Row label="ACTIVE ITEMS" value={m.items.length} />
            <Row label="UNITS ON HAND" value={m.units} />
            <Row label="VALUE AT RETAIL" value={fmtMoney(m.retailValueCents)} />
            <Row label="LOW STOCK" value={m.lowCount} />
            <Row label="OUT OF STOCK" value={m.outCount} strong />
          </dl>
        </fieldset>
        {m.items.length === 0 ? <div className="vm-notice" role="status">*** NO ACTIVE MERCHANDISE ***</div> : (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 640 }}>
              <thead><tr><th scope="col">SKU</th><th scope="col">ITEM</th><th scope="col">CATEGORY</th><th scope="col">ON HAND</th><th scope="col">PRICE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {m.items.map((i) => {
                  const st = stockState(i.quantityOnHand, i.lowStockThreshold);
                  return (
                    <tr key={i.id}>
                      <td>{i.sku}</td><td>{i.name.toUpperCase()}</td>
                      <td>{i.category.name}</td>
                      <td>{i.quantityOnHand}</td><td>${i.retailPrice.toFixed(2)}</td>
                      <td>{st === "OUT" ? <span className="vm-red"><strong>OUT OF STOCK</strong></span> : st === "LOW" ? <span className="vm-yellow"><strong>*** LOW STOCK</strong></span> : "OK"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReportShell>
    );
  }

  if (slug === "revenue") {
    const r = resolveRange(sp.from, sp.to, 30, tz);
    const v = await revenue(store.id, r);
    return (
      <ReportShell {...base} title="REVENUE" filter={{ kind: "range", from: r.fromStr, to: r.toStr }} notice={r.invalid ? "*** INVALID DATE IGNORED. USE YYYY-MM-DD. ***" : undefined}>
        <fieldset className="vm-section">
          <legend>REVENUE {r.fromStr} TO {r.toStr}</legend>
          <dl className="vm-kv">
            <Row label="RENTAL REVENUE" value={fmtMoney(v.rentalCents)} />
            <Row label="MERCHANDISE REVENUE" value={fmtMoney(v.merchandiseCents)} />
            <Row label="FEES (LATE / DAMAGE / LOST / REWIND / MEMBERSHIP)" value={fmtMoney(v.feeCents)} />
            <Row label="TAXES" value={fmtMoney(v.taxCents)} />
            <Row label="TOTAL" value={fmtMoney(v.totalCents)} strong />
            <Row label="TRANSACTIONS" value={v.transactions} />
          </dl>
        </fieldset>
        {v.byPayment.length > 0 && (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 420 }}>
              <caption className="vm-hint" style={{ textAlign: "left" }}>BY PAYMENT METHOD</caption>
              <thead><tr><th scope="col">METHOD</th><th scope="col">TRANSACTIONS</th><th scope="col">TOTAL</th></tr></thead>
              <tbody>{v.byPayment.map((p) => <tr key={p.method}><td>{PAYMENT_LABELS[p.method as PaymentMethod]}</td><td>{p.count}</td><td>{fmtMoney(p.totalCents)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </ReportShell>
    );
  }

  notFound();
}

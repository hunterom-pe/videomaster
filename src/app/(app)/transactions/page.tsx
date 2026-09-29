import Link from "next/link";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";
import { parseDay } from "@/lib/dates";
import { fmtDateTimeTz, tzAbbrev } from "@/lib/tz";
import { PAGE_SIZE, PAYMENT_LABELS, TYPE_LABELS, searchTransactions } from "@/lib/transactions";

export const metadata = { title: "TRANSACTIONS" };

type SP = { q?: string; type?: string; payment?: string; from?: string; to?: string; page?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const sp = await searchParams;
  const f = { q: (sp.q ?? "").slice(0, 60), type: sp.type ?? "", payment: sp.payment ?? "", from: sp.from ?? "", to: sp.to ?? "" };
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const badDate = (f.from && !parseDay(f.from)) || (f.to && !parseDay(f.to));
  const { rows, total, sum, pages } = await searchTransactions(store.id, f, page, tz);
  const filtered = !!(f.q || f.type || f.payment || f.from || f.to);
  const href = (p: number) => `/transactions?${new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.type && { type: f.type }), ...(f.payment && { payment: f.payment }), ...(f.from && { from: f.from }), ...(f.to && { to: f.to }), page: String(p) })}`;

  return (
    <Screen title="TRANSACTIONS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>TRANSACTION HISTORY</h1>
        <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
      </div>
      <hr className="vm-rule" />
      {badDate && <div className="vm-notice" role="status">*** INVALID DATE IGNORED. USE YYYY-MM-DD. ***</div>}
      <form action="/transactions" method="get" className="vm-searchbar" role="search">
        <div className="vm-field" style={{ flex: "2 1 200px" }}>
          <label htmlFor="q">TRANSACTION # OR CUSTOMER</label>
          <input id="q" name="q" type="text" defaultValue={f.q} autoComplete="off" />
        </div>
        <div className="vm-field" style={{ flex: "0 1 170px" }}>
          <label htmlFor="type">TYPE</label>
          <select id="type" name="type" defaultValue={f.type}>
            <option value="">ALL</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="vm-field" style={{ flex: "0 1 170px" }}>
          <label htmlFor="payment">PAYMENT</label>
          <select id="payment" name="payment" defaultValue={f.payment}>
            <option value="">ALL</option>
            {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="vm-field" style={{ flex: "0 1 150px" }}>
          <label htmlFor="from">FROM (YYYY-MM-DD)</label>
          <input id="from" name="from" type="text" defaultValue={f.from} placeholder="1996-09-01" autoComplete="off" />
        </div>
        <div className="vm-field" style={{ flex: "0 1 150px" }}>
          <label htmlFor="to">TO (YYYY-MM-DD)</label>
          <input id="to" name="to" type="text" defaultValue={f.to} placeholder="1996-09-30" autoComplete="off" />
        </div>
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
        {filtered && <Link href="/transactions" className="vm-btn">[ CLEAR ]</Link>}
      </form>

      {total === 0 ? (
        <div className="vm-notice" role="status">{filtered ? "*** NO TRANSACTIONS MATCH ***" : "*** NO TRANSACTIONS YET. THEY APPEAR HERE AFTER YOUR FIRST RENTAL, RETURN OR SALE. ***"}</div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>
                {total} TRANSACTION{total === 1 ? "" : "S"} · TOTAL ${Number(sum ?? 0).toFixed(2)} · NEWEST FIRST · CLICK A ROW FOR DETAIL
              </caption>
              <thead><tr><th scope="col">TRANS #</th><th scope="col">DATE / TIME ({tzAbbrev(tz)})</th><th scope="col">TYPE</th><th scope="col">CUSTOMER</th><th scope="col">ITEMS</th><th scope="col">TOTAL</th><th scope="col">PAID BY</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/transactions/${t.id}`} className="vm-rowlink">{String(t.number).padStart(6, "0")}</Link></td>
                    <td>{fmtDateTimeTz(t.createdAt, tz)}</td>
                    <td>{TYPE_LABELS[t.type]}</td>
                    <td>{t.customer ? `${t.customer.lastName.toUpperCase()}, ${t.customer.firstName.toUpperCase()}` : "WALK-IN"}</td>
                    <td>{t._count.rentals + t._count.items + t._count.returnedRentals}</td>
                    <td>${t.total.toFixed(2)}</td>
                    <td>{PAYMENT_LABELS[t.paymentMethod]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="vm-pager">
              {page > 1 ? <Link href={href(page - 1)} className="vm-btn small">[ &lt; PREV ]</Link> : null}
              <span>PAGE {page} OF {pages} ({PAGE_SIZE} PER PAGE)</span>
              {page < pages ? <Link href={href(page + 1)} className="vm-btn small">[ NEXT &gt; ]</Link> : null}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { HISTORY_PAGE_SIZE, customerStats, rentalHistory, transactionHistory } from "@/lib/customer-history";
import { db } from "@/lib/db";
import { overdueCutoff } from "@/lib/late-fees";
import { fmtDate, fmtMoney, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_LABELS, TYPE_LABELS } from "@/lib/transactions";
import { fmtDateTimeTz } from "@/lib/tz";

export const metadata = { title: "CUSTOMER HISTORY" };

const money = (c: number) => (c < 0 ? `-${fmtMoney(-c)}` : fmtMoney(c));

export default async function CustomerHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; page?: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const view = sp.view === "transactions" ? "transactions" : "rentals";
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const s = await customerStats(store.id, c.id);
  const cutoff = overdueCutoff(new Date(), tz);
  const href = (v: string, p = 1) => `/customers/${c.id}/history?view=${v}&page=${p}`;

  const rentals = view === "rentals" ? await rentalHistory(store.id, c.id, page) : null;
  const txs = view === "transactions" ? await transactionHistory(store.id, c.id, page) : null;
  const pages = (rentals ?? txs)!.pages;
  const total = (rentals ?? txs)!.total;

  return (
    <Screen title="CUSTOMER HISTORY" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>HISTORY — {c.lastName.toUpperCase()}, {c.firstName.toUpperCase()} (#{c.membershipNumber})</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href={`/customers/${c.id}`} className="vm-btn">[ ACCOUNT ]</Link>
          <Link href="/customers" className="vm-btn">[ CUSTOMER SEARCH ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <fieldset className="vm-section">
        <legend>LIFETIME SUMMARY</legend>
        <dl className="vm-kv">
          <dt>TOTAL RENTALS</dt><dd>{s.rentals}{s.out > 0 ? ` (${s.out} OUT NOW)` : ""}</dd>
          <dt>LATE RETURNS</dt><dd>{s.lateReturns}</dd>
          <dt>LOST / DAMAGED</dt><dd className={s.lost + s.damaged > 0 ? "vm-yellow" : ""}>{s.lost} LOST · {s.damaged} DAMAGED</dd>
          <dt>NET SPENT</dt><dd>{money(s.netSpentCents)} OVER {s.transactions} TRANSACTION{s.transactions === 1 ? "" : "S"}</dd>
          <dt>BALANCE DUE</dt><dd>{toCents(c.outstandingFees) > 0 ? <Link href={`/customers/${c.id}/balance`} className="vm-red">{fmtMoney(toCents(c.outstandingFees))}</Link> : "$0.00"}</dd>
          <dt>FIRST / LAST VISIT</dt><dd>{s.firstVisit && s.lastVisit ? `${fmtDate(s.firstVisit, tz)} / ${fmtDate(s.lastVisit, tz)}` : "—"}</dd>
          <dt>FAVORITES</dt>
          <dd>{s.favorites.length === 0 ? "—" : s.favorites.map((f, i) => (
            <span key={f.id}>{i > 0 && " · "}<Link href={`/inventory/${f.id}`}>{f.title.toUpperCase()}</Link> ({f.count})</span>
          ))}</dd>
        </dl>
      </fieldset>

      <div className="vm-actions" style={{ marginTop: 0 }} role="group" aria-label="History view">
        <Link href={href("rentals")} className="vm-btn" aria-current={view === "rentals" ? "page" : undefined} style={view === "rentals" ? { background: "var(--cyan)" } : undefined}>[ RENTALS ]</Link>
        <Link href={href("transactions")} className="vm-btn" aria-current={view === "transactions" ? "page" : undefined} style={view === "transactions" ? { background: "var(--cyan)" } : undefined}>[ TRANSACTIONS ]</Link>
      </div>

      {total === 0 ? (
        <div className="vm-notice" role="status">*** NO {view === "rentals" ? "RENTALS" : "TRANSACTIONS"} YET ***</div>
      ) : (
        <div className="vm-tablewrap">
          {rentals && (
            <table className="vm-table" style={{ minWidth: 720 }}>
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>{total} RENTAL{total === 1 ? "" : "S"} · NEWEST FIRST · CLICK A TITLE FOR DETAIL</caption>
              <thead><tr><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">RENTED</th><th scope="col">DUE</th><th scope="col">RETURNED</th><th scope="col">PRICE</th><th scope="col">LATE FEE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {rentals.rows.map((r) => {
                  const overdue = !r.returnedAt && r.dueAt < cutoff;
                  const late = toCents(r.chargedLateFee ?? 0);
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/inventory/${r.copy.movieTitleId}`}>{r.copy.movieTitle.title.toUpperCase()}</Link>{r.copy.movieTitle.year ? ` (${r.copy.movieTitle.year})` : ""}</td>
                      <td>{r.copy.copyNumber}</td>
                      <td>{fmtDate(r.rentedAt, tz)}</td>
                      <td>{fmtDate(r.dueAt, tz)}</td>
                      <td>{r.returnedAt ? fmtDate(r.returnedAt, tz) : "—"}</td>
                      <td>{fmtMoney(toCents(r.price))}{r.refundedAt ? " (REFUNDED)" : ""}</td>
                      <td>{late > 0 ? fmtMoney(late) : "—"}</td>
                      <td>
                        {r.returnedAt ? (
                          <span className={r.outcome === "RETURNED" ? "" : "vm-yellow"}>{r.outcome ?? "RETURNED"}</span>
                        ) : overdue ? <span className="vm-red"><strong>OVERDUE</strong></span> : "OUT"}
                        {r.returnTransactionId && <> · <Link href={`/transactions/${r.returnTransactionId}`}>RECEIPT</Link></>}
                        {r.returnedAt && <> · <Link href={`/rent/${c.id}?again=${r.id}`}>RENT AGAIN</Link></>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {txs && (
            <table className="vm-table rows" style={{ minWidth: 560 }}>
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>{total} TRANSACTION{total === 1 ? "" : "S"} · NEWEST FIRST · CLICK A ROW FOR DETAIL</caption>
              <thead><tr><th scope="col">TRANS #</th><th scope="col">DATE / TIME</th><th scope="col">TYPE</th><th scope="col">TOTAL</th><th scope="col">PAID BY</th><th scope="col">ACCOUNT</th></tr></thead>
              <tbody>
                {txs.rows.map((t) => {
                  const bal = toCents(t.balanceChange);
                  return (
                    <tr key={t.id}>
                      <td><Link href={`/transactions/${t.id}`} className="vm-rowlink">{String(t.number).padStart(6, "0")}</Link></td>
                      <td>{fmtDateTimeTz(t.createdAt, tz)}</td>
                      <td>{TYPE_LABELS[t.type]}{t.voidedAt && <span className="vm-red"> VOID</span>}</td>
                      <td>{t.voidedAt ? <s>{money(toCents(t.total))}</s> : money(toCents(t.total))}</td>
                      <td>{PAYMENT_LABELS[t.paymentMethod]}</td>
                      <td>{bal === 0 ? "—" : bal > 0 ? `+${fmtMoney(bal)} OWED` : `-${fmtMoney(-bal)}`}{t.type === "RENTAL" && !t.voidedAt && <> <Link href={`/rent/${c.id}?againTx=${t.id}`}>RENT AGAIN</Link></>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {pages > 1 && (
        <div className="vm-pager">
          {page > 1 ? <Link href={href(view, page - 1)} className="vm-btn small">[ &lt; PREV ]</Link> : null}
          <span>PAGE {page} OF {pages} ({HISTORY_PAGE_SIZE} PER PAGE)</span>
          {page < pages ? <Link href={href(view, page + 1)} className="vm-btn small">[ NEXT &gt; ]</Link> : null}
        </div>
      )}
    </Screen>
  );
}

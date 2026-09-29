import Link from "next/link";
import { Screen } from "@/components/Screen";
import { listOverdue } from "@/lib/overdue";
import { fmtDate, fmtMoney } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

const PAGE_SIZE = 25;

export default async function OverduePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const { rows, capped } = await listOverdue(store.id);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const customers = new Set(rows.map((r) => r.customerId)).size;
  const accrued = rows.reduce((n, r) => n + r.feeCents, 0);

  return (
    <Screen title="OVERDUE RENTALS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`} status={rows.length ? "*** OVERDUE RENTALS ON FILE ***" : "SYSTEM READY"}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>OVERDUE RENTALS</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/return" className="vm-btn">[ RETURN VIDEO ]</Link>
          <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {rows.length === 0 ? (
        <div className="vm-notice" role="status">*** NO OVERDUE RENTALS *** ALL VIDEOS ARE ON TIME.</div>
      ) : (
        <>
          <div className="vm-alert" role="alert">
            <strong>*** {rows.length} OVERDUE VIDEO{rows.length === 1 ? "" : "S"} ***</strong>
            {customers} CUSTOMER{customers === 1 ? "" : "S"} · ACCRUED LATE FEES {fmtMoney(accrued)}
            {capped && <div>SHOWING THE FIRST 5,000 RENTALS ONLY.</div>}
          </div>
          <div className="vm-tablewrap">
            <table className="vm-table rows" style={{ minWidth: 820 }}>
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>MOST LATE FIRST · CLICK A ROW TO RETURN THE VIDEO · CLICK A NAME TO OPEN THE ACCOUNT</caption>
              <thead>
                <tr><th scope="col">CUSTOMER</th><th scope="col">PHONE</th><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">DUE DATE</th><th scope="col">DAYS LATE</th><th scope="col">LATE FEE</th><th scope="col">BALANCE</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.rentalId}>
                    <td><Link href={`/customers/${r.customerId}`} className="vm-rowsublink">{r.customerName}</Link></td>
                    <td>{r.phone ?? "—"}</td>
                    <td><Link href={`/return/${r.rentalId}`} className="vm-rowlink">{r.title.toUpperCase()}</Link></td>
                    <td>{r.copyNumber}</td>
                    <td>{fmtDate(r.dueAt)}</td>
                    <td><span className={r.daysLate > 7 ? "vm-overdue-hot" : "vm-overdue-warm"}>{r.daysLate > 7 ? "*** " : ""}{r.daysLate}</span></td>
                    <td>{fmtMoney(r.feeCents)}</td>
                    <td>{fmtMoney(r.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="vm-pager">
              {page > 1 ? <Link href={`/overdue?page=${page - 1}`} className="vm-btn small">[ &lt; PREV ]</Link> : null}
              <span>PAGE {page} OF {pages}</span>
              {page < pages ? <Link href={`/overdue?page=${page + 1}`} className="vm-btn small">[ NEXT &gt; ]</Link> : null}
            </div>
          )}
          <p className="vm-hint">LATE FEE = FEE ACCRUED SO FAR ON THAT VIDEO. BALANCE = CUSTOMER&apos;S TOTAL ACCRUED LATE FEES PLUS OUTSTANDING FEES.</p>
        </>
      )}
    </Screen>
  );
}

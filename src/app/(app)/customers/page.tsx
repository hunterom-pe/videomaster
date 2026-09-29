import Link from "next/link";
import { Screen } from "@/components/Screen";
import { searchCustomers } from "@/lib/customers";
import { effectiveStatus, overdueCounts } from "@/lib/overdue";
import { requireStore } from "@/lib/store-access";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const { rows, total, pages } = await searchCustomers(store.id, q, page);
  const overdue = await overdueCounts(store.id, rows.map((r) => r.id));
  const href = (p: number) => `/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <Screen title="CUSTOMERS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>CUSTOMER SEARCH</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/customers/new" className="vm-btn">[ ADD CUSTOMER ]</Link>
          <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <form action="/customers" method="get" className="vm-searchbar" role="search">
        <div className="vm-field">
          <label htmlFor="q">NAME, PHONE OR MEMBERSHIP NUMBER</label>
          <input id="q" name="q" type="text" defaultValue={q} autoComplete="off" />
        </div>
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
        {q && <Link href="/customers" className="vm-btn">[ CLEAR ]</Link>}
      </form>

      {total === 0 ? (
        <div className="vm-notice" role="status">
          {q ? `*** NO CUSTOMERS MATCH "${q.toUpperCase()}" ***` : "*** NO CUSTOMERS ON FILE. CLICK [ ADD CUSTOMER ] TO REGISTER ONE. ***"}
        </div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>
                {total} CUSTOMER{total === 1 ? "" : "S"} · CLICK A ROW TO OPEN THE ACCOUNT
              </caption>
              <thead>
                <tr>
                  <th scope="col">MEMBER #</th>
                  <th scope="col">NAME</th>
                  <th scope="col">PHONE</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">FEES DUE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.membershipNumber}</td>
                    <td>
                      <Link href={`/customers/${c.id}`} className="vm-rowlink">{c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</Link>
                    </td>
                    <td>{c.phone ?? "—"}</td>
                    <td><span className={`vm-status ${effectiveStatus(c.status, overdue.get(c.id) ?? 0)}`}>{effectiveStatus(c.status, overdue.get(c.id) ?? 0)}</span></td>
                    <td>${c.outstandingFees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="vm-pager">
              {page > 1 ? <Link href={href(page - 1)} className="vm-btn small">[ &lt; PREV ]</Link> : <span className="vm-btn small" aria-disabled="true" style={{ opacity: 0.5 }}>[ &lt; PREV ]</span>}
              <span>PAGE {page} OF {pages}</span>
              {page < pages ? <Link href={href(page + 1)} className="vm-btn small">[ NEXT &gt; ]</Link> : <span className="vm-btn small" aria-disabled="true" style={{ opacity: 0.5 }}>[ NEXT &gt; ]</span>}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

import Link from "next/link";
import { Screen } from "@/components/Screen";
import { searchCustomers } from "@/lib/customers";
import { requireStore } from "@/lib/store-access";

export default async function RentPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const { rows, total, pages } = await searchCustomers(store.id, q, page);
  const href = (p: number) => `/rent?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <Screen title="RENT VIDEO" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>SELECT CUSTOMER</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/sale" className="vm-btn">[ SELL MERCHANDISE ONLY ]</Link>
          <Link href="/customers/new" className="vm-btn">[ NEW CUSTOMER ]</Link>
          <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <form action="/rent" method="get" className="vm-searchbar" role="search">
        <div className="vm-field">
          <label htmlFor="q">CUSTOMER NAME, PHONE OR MEMBERSHIP NUMBER</label>
          <input id="q" name="q" type="text" defaultValue={q} autoComplete="off" />
        </div>
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
        {q && <Link href="/rent" className="vm-btn">[ CLEAR ]</Link>}
      </form>
      {total === 0 ? (
        <div className="vm-notice" role="status">{q ? `*** NO CUSTOMERS MATCH "${q.toUpperCase()}" ***` : "*** NO CUSTOMERS ON FILE. CLICK [ NEW CUSTOMER ]. ***"}</div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>CLICK A CUSTOMER TO START CHECKOUT</caption>
              <thead><tr><th scope="col">MEMBER #</th><th scope="col">NAME</th><th scope="col">PHONE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.membershipNumber}</td>
                    <td><Link href={`/rent/${c.id}`} className="vm-rowlink">{c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</Link></td>
                    <td>{c.phone ?? "—"}</td>
                    <td><span className={`vm-status ${c.status}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="vm-pager">
              {page > 1 ? <Link href={href(page - 1)} className="vm-btn small">[ &lt; PREV ]</Link> : null}
              <span>PAGE {page} OF {pages}</span>
              {page < pages ? <Link href={href(page + 1)} className="vm-btn small">[ NEXT &gt; ]</Link> : null}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

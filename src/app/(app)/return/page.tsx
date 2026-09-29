import Link from "next/link";
import { listActiveRentals } from "@/actions/returns";
import { Screen } from "@/components/Screen";
import { FORMAT_LABELS } from "@/lib/inventory";
import { daysLate } from "@/lib/late-fees";
import { fmtDate } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

const PAGE_SIZE = 25;

export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const { rows, total, pages } = await listActiveRentals(q, page, PAGE_SIZE);
  const href = (p: number) => `/return?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  const now = new Date();

  return (
    <Screen title="RETURN VIDEO" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>RETURN VIDEO</h1>
        <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
      </div>
      <hr className="vm-rule" />
      <form action="/return" method="get" className="vm-searchbar" role="search">
        <div className="vm-field">
          <label htmlFor="q">COPY ID, BARCODE, MOVIE TITLE OR CUSTOMER</label>
          <input id="q" name="q" type="text" defaultValue={q} autoComplete="off" autoFocus />
        </div>
        <button type="submit" className="vm-btn">[ FIND ]</button>
        {q && <Link href="/return" className="vm-btn">[ CLEAR ]</Link>}
      </form>

      {total === 0 ? (
        <div className="vm-notice" role="status">
          {q ? `*** NO RENTED VIDEOS MATCH "${q.toUpperCase()}" ***` : "*** NO VIDEOS ARE CURRENTLY OUT ***"}
          {q && <div className="vm-hint">ONLY VIDEOS THAT ARE CURRENTLY RENTED CAN BE RETURNED.</div>}
        </div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>
                {total} VIDEO{total === 1 ? "" : "S"} OUT · OLDEST DUE FIRST · CLICK A ROW TO RETURN IT
              </caption>
              <thead><tr><th scope="col">COPY</th><th scope="col">TITLE</th><th scope="col">CUSTOMER</th><th scope="col">DUE</th><th scope="col">DAYS LATE</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const late = daysLate(r.dueAt, now, tz);
                  return (
                    <tr key={r.id}>
                      <td>{r.copy.copyNumber}</td>
                      <td>
                        <Link href={`/return/${r.id}`} className="vm-rowlink">{r.copy.movieTitle.title.toUpperCase()}</Link>{" "}
                        <span className="vm-dim">{FORMAT_LABELS[r.copy.format]}</span>
                      </td>
                      <td>{r.customer.lastName.toUpperCase()}, {r.customer.firstName.toUpperCase()}</td>
                      <td>{fmtDate(r.dueAt, tz)}</td>
                      <td>{late > 0 ? <span className="vm-red"><strong>{late} LATE</strong></span> : "—"}</td>
                    </tr>
                  );
                })}
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

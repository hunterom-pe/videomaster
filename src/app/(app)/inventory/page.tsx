import Link from "next/link";
import { Screen } from "@/components/Screen";
import { FORMAT_LABELS, searchTitles, summarize } from "@/lib/inventory";
import { requireStore } from "@/lib/store-access";

type SP = { q?: string; format?: string; cat?: string; avail?: string; page?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const f = { q: (sp.q ?? "").slice(0, 100), format: sp.format ?? "", categoryId: sp.cat ?? "", availability: sp.avail ?? "" };
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));
  const { titles, total, pages, groups } = await searchTitles(store.id, f, page);
  const filtered = !!(f.q || f.format || f.categoryId || f.availability);
  const href = (p: number) =>
    `/inventory?${new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.format && { format: f.format }), ...(f.categoryId && { cat: f.categoryId }), ...(f.availability && { avail: f.availability }), page: String(p) })}`;
  const formats = store.formats.filter((x) => x.enabled);

  return (
    <Screen title="MOVIE INVENTORY" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>INVENTORY SEARCH</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/inventory/add" className="vm-btn">[ ADD TITLE ]</Link>
          <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <form action="/inventory" method="get" className="vm-searchbar" role="search">
        <div className="vm-field" style={{ flex: "2 1 260px" }}>
          <label htmlFor="q">TITLE, YEAR, ACTOR, DIRECTOR, GENRE OR COPY ID</label>
          <input id="q" name="q" type="text" defaultValue={f.q} autoComplete="off" />
        </div>
        <div className="vm-field" style={{ flex: "0 1 150px" }}>
          <label htmlFor="format">FORMAT</label>
          <select id="format" name="format" defaultValue={f.format}>
            <option value="">ALL</option>
            {formats.map((x) => <option key={x.format} value={x.format}>{FORMAT_LABELS[x.format]}</option>)}
          </select>
        </div>
        <div className="vm-field" style={{ flex: "0 1 170px" }}>
          <label htmlFor="cat">CATEGORY</label>
          <select id="cat" name="cat" defaultValue={f.categoryId}>
            <option value="">ALL</option>
            {store.rentalCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="vm-field" style={{ flex: "0 1 150px" }}>
          <label htmlFor="avail">AVAILABILITY</label>
          <select id="avail" name="avail" defaultValue={f.availability}>
            <option value="">ANY</option>
            <option value="available">AVAILABLE</option>
            <option value="out">OUT</option>
          </select>
        </div>
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
        {filtered && <Link href="/inventory" className="vm-btn">[ CLEAR ]</Link>}
      </form>

      {total === 0 ? (
        <div className="vm-notice" role="status">
          {filtered ? "*** NO TITLES MATCH YOUR SEARCH ***" : "*** NO TITLES IN INVENTORY. CLICK [ ADD TITLE ] TO ADD YOUR FIRST MOVIE. ***"}
        </div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>
                {total} TITLE{total === 1 ? "" : "S"} · CLICK A ROW TO OPEN THE TITLE
              </caption>
              <thead>
                <tr><th scope="col">TITLE</th><th scope="col">YEAR</th><th scope="col">FORMAT</th><th scope="col">TOTAL</th><th scope="col">AVAIL</th><th scope="col">OUT</th></tr>
              </thead>
              <tbody>
                {titles.map((t) => {
                  const sums = summarize(groups.filter((g) => g.movieTitleId === t.id));
                  const rows = sums.length ? sums : [null];
                  return rows.map((s, i) => (
                    <tr key={`${t.id}-${s?.format ?? "none"}`}>
                      <td>{i === 0 ? <Link href={`/inventory/${t.id}`} className="vm-rowlink">{t.title.toUpperCase()}</Link> : null}</td>
                      <td>{i === 0 ? (t.year ?? "—") : ""}</td>
                      <td>{s ? FORMAT_LABELS[s.format] : "NO COPIES"}</td>
                      <td>{s?.total ?? 0}</td>
                      <td>{s?.available ?? 0}</td>
                      <td>{s?.out ?? 0}</td>
                    </tr>
                  ));
                })}
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

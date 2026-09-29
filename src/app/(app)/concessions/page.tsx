import Link from "next/link";
import { Screen } from "@/components/Screen";
import { stockState } from "@/lib/concessions";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "CONCESSIONS" };

const PAGE_SIZE = 30;

export default async function ConcessionsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; page?: string; saved?: string; inactive?: string }> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  // Only a category id that belongs to this store counts as a filter.
  const cat = store.concessionCategories.find((c) => c.id === sp.cat)?.id;
  const showInactive = sp.inactive === "1";
  const page = Math.max(1, Math.min(100000, parseInt(sp.page ?? "1", 10) || 1));

  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const where = {
    storeId: store.id,
    ...(cat ? { categoryId: cat } : {}),
    ...(showInactive ? {} : { active: true }),
    AND: terms.map((t) => ({ OR: [{ name: { contains: t, mode: "insensitive" as const } }, { sku: { contains: t, mode: "insensitive" as const } }, { barcode: t }] })),
  };
  const [items, total, lowRows] = await Promise.all([
    db.concessionItem.findMany({ where, orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: { select: { name: true } } } }),
    db.concessionItem.count({ where }),
    // Low-stock warnings cover the whole active catalog, independent of the current search/page.
    db.$queryRaw<{ sku: string; name: string; quantityOnHand: number }[]>`
      SELECT sku, name, "quantityOnHand" FROM "ConcessionItem"
      WHERE "storeId" = ${store.id} AND active AND "quantityOnHand" <= "lowStockThreshold" ORDER BY sku LIMIT 50`,
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/concessions?${new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(showInactive && { inactive: "1" }), page: String(p) })}`;
  const filtered = !!(q || cat || showInactive);

  return (
    <Screen title="CONCESSIONS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>CONCESSIONS / MERCHANDISE</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/sale" className="vm-btn">[ SELL MERCHANDISE ]</Link>
          <Link href="/concessions/new" className="vm-btn">[ ADD ITEM ]</Link>
          <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {sp.saved && <div className="vm-notice" role="status">*** ITEM SAVED ***</div>}
      {lowRows.length > 0 && (
        <div className="vm-alert" role="alert">
          <strong>*** LOW INVENTORY ***</strong>
          {lowRows.map((r) => (
            <div key={r.sku}>*** {r.sku} {r.name.toUpperCase()}: {r.quantityOnHand <= 0 ? "OUT OF STOCK" : `LOW STOCK (${r.quantityOnHand} ON HAND)`} ***</div>
          ))}
        </div>
      )}
      <form action="/concessions" method="get" className="vm-searchbar" role="search">
        <div className="vm-field" style={{ flex: "2 1 240px" }}>
          <label htmlFor="q">NAME, SKU OR BARCODE</label>
          <input id="q" name="q" type="text" defaultValue={q} autoComplete="off" />
        </div>
        <div className="vm-field" style={{ flex: "0 1 200px" }}>
          <label htmlFor="cat">CATEGORY</label>
          <select id="cat" name="cat" defaultValue={cat ?? ""}>
            <option value="">ALL</option>
            {store.concessionCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className="vm-check" style={{ flex: "0 0 auto" }}>
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} /><span>SHOW INACTIVE</span>
        </label>
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
        {filtered && <Link href="/concessions" className="vm-btn">[ CLEAR ]</Link>}
      </form>

      {total === 0 ? (
        <div className="vm-notice" role="status">{filtered ? "*** NO ITEMS MATCH ***" : "*** NO MERCHANDISE YET. CLICK [ ADD ITEM ] TO ADD CANDY, POPCORN, DRINKS... ***"}</div>
      ) : (
        <>
          <div className="vm-tablewrap">
            <table className="vm-table rows">
              <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>{total} ITEM{total === 1 ? "" : "S"} · CLICK A ROW TO EDIT OR RECEIVE STOCK</caption>
              <thead><tr><th scope="col">SKU</th><th scope="col">ITEM</th><th scope="col">CATEGORY</th><th scope="col">ON HAND</th><th scope="col">PRICE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {items.map((i) => {
                  const st = stockState(i.quantityOnHand, i.lowStockThreshold);
                  return (
                    <tr key={i.id} className={i.active ? "" : "vm-dim"}>
                      <td>{i.sku}</td>
                      <td><Link href={`/concessions/${i.id}`} className="vm-rowlink">{i.name.toUpperCase()}</Link></td>
                      <td>{i.category.name}</td>
                      <td>{i.quantityOnHand}</td>
                      <td>${i.retailPrice.toFixed(2)}{i.taxable ? "" : " (NO TAX)"}</td>
                      <td>
                        {!i.active ? "INACTIVE" : st === "OUT" ? <span className="vm-red"><strong>OUT OF STOCK</strong></span> : st === "LOW" ? <span className="vm-yellow"><strong>*** LOW STOCK</strong></span> : "OK"}
                      </td>
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

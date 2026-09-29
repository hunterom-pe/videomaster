import Link from "next/link";
import { notFound } from "next/navigation";
import { AddCopiesForm } from "@/components/InventoryForms";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS, summarize } from "@/lib/inventory";
import { categoryOptions, formatDefaultCategories, formatOptions } from "@/lib/inventory-options";
import { overdueWhere } from "@/lib/overdue";
import { requireStore } from "@/lib/store-access";
import { posterUrl } from "@/lib/tmdb";

export const metadata = { title: "TITLE RECORD" };

const MAX_COPIES_SHOWN = 300;

export default async function TitlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; copy?: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const t = await db.movieTitle.findFirst({ where: { id, storeId: store.id } });
  if (!t) notFound();
  const { added, copy: savedCopy } = await searchParams;

  const overdueRentals = await db.rental.findMany({ where: { ...overdueWhere(store.id, tz), copy: { movieTitleId: t.id } }, select: { copyId: true, copy: { select: { format: true } } } });
  const overdueIds = new Set(overdueRentals.map((r) => r.copyId));
  const overdueByFormat = new Map<string, number>();
  for (const r of overdueRentals) overdueByFormat.set(r.copy.format, (overdueByFormat.get(r.copy.format) ?? 0) + 1);
  const [copies, groups] = await Promise.all([
    db.inventoryCopy.findMany({ where: { storeId: store.id, movieTitleId: t.id }, orderBy: { copyNumber: "asc" }, take: MAX_COPIES_SHOWN, include: { rentalCategory: { select: { name: true } } } }),
    db.inventoryCopy.groupBy({ by: ["movieTitleId", "format", "status"], where: { storeId: store.id, movieTitleId: t.id }, _count: { _all: true } }),
  ]);
  const sums = summarize(groups);
  const retired = groups.filter((g) => g.status === "RETIRED").reduce((n, g) => n + g._count._all, 0);
  const total = sums.reduce((n, s) => n + s.total, 0);
  const formats = formatOptions(store);
  const categories = categoryOptions(store);
  const formatDefaults = formatDefaultCategories(store);
  const poster = posterUrl(t.posterPath, "w185");
  const price = (name: string | undefined) => store.rentalCategories.find((c) => c.name === name);

  return (
    <Screen title="TITLE RECORD" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>{t.title.toUpperCase()}{t.year ? ` (${t.year})` : ""}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/rent" className="vm-btn small">[ RENT ]</Link>
          <Link href="/inventory" className="vm-btn">[ INVENTORY ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {added && <div className="vm-notice" role="status">*** {added} COPY RECORD{added === "1" ? "" : "S"} ADDED ***</div>}
      {savedCopy && <div className="vm-notice" role="status">*** COPY {savedCopy} SAVED ***</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster && <img src={poster} alt={`${t.title} poster`} width={92} style={{ border: "2px solid var(--gray)", alignSelf: "flex-start" }} />}
        <dl className="vm-kv" style={{ flex: "1 1 320px" }}>
          <dt>DIRECTOR</dt><dd>{t.director ?? "—"}</dd>
          <dt>RUNTIME</dt><dd>{t.runtimeMinutes ? `${t.runtimeMinutes} MIN` : "—"}</dd>
          <dt>RATING</dt><dd>{t.rating ?? "—"}</dd>
          <dt>GENRE</dt><dd>{t.genres.join(", ") || "—"}</dd>
          <dt>CAST</dt><dd>{t.cast.join(", ") || "—"}</dd>
          <dt>PLOT</dt><dd>{t.overview ?? "—"}</dd>
        </dl>
      </div>

      <fieldset className="vm-section">
        <legend>COPIES BY FORMAT</legend>
        {sums.length === 0 ? <span className="vm-dim">NO ACTIVE COPIES</span> : (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 480 }}>
              <thead><tr><th scope="col">FORMAT</th><th scope="col">TOTAL</th><th scope="col">AVAILABLE</th><th scope="col">RENTED</th><th scope="col">OVERDUE</th><th scope="col">DAMAGED/REPAIR</th><th scope="col">LOST</th></tr></thead>
              <tbody>
                {sums.map((s) => (
                  <tr key={s.format}><td>{FORMAT_LABELS[s.format]}</td><td>{s.total}</td><td>{s.available}</td><td>{s.out}</td><td>{(overdueByFormat.get(s.format) ?? 0) > 0 ? <span className="vm-red"><strong>{overdueByFormat.get(s.format)}</strong></span> : 0}</td><td>{s.damaged}</td><td>{s.lost}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="vm-hint">{total} TOTAL{retired > 0 ? ` · ${retired} RETIRED (NOT COUNTED)` : ""}</p>
      </fieldset>

      <fieldset className="vm-section">
        <legend>INDIVIDUAL COPIES</legend>
        <div className="vm-tablewrap">
          <table className="vm-table rows">
            <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>CLICK A COPY TO EDIT STATUS, CONDITION, BARCODE OR RETIRE IT</caption>
            <thead><tr><th scope="col">COPY ID</th><th scope="col">FORMAT</th><th scope="col">STATUS</th><th scope="col">CONDITION</th><th scope="col">CATEGORY</th><th scope="col">PRICE</th></tr></thead>
            <tbody>
              {copies.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/inventory/${t.id}/copy/${c.id}`} className="vm-rowlink">{c.copyNumber}</Link></td>
                  <td>{FORMAT_LABELS[c.format]}</td>
                  <td><span className={`vm-status ${overdueIds.has(c.id) ? "BLOCKED" : c.status === "AVAILABLE" ? "GOOD" : c.status === "RENTED" ? "SUSPENDED" : c.status === "RETIRED" ? "CLOSED" : "BLOCKED"}`}>{overdueIds.has(c.id) ? "OVERDUE" : c.status}</span></td>
                  <td>{c.condition ?? "—"}</td>
                  <td>{c.rentalCategory?.name ?? "—"}</td>
                  <td>{price(c.rentalCategory?.name) ? `$${price(c.rentalCategory?.name)!.rentalPrice.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total + retired > MAX_COPIES_SHOWN && <p className="vm-hint">SHOWING FIRST {MAX_COPIES_SHOWN} COPIES.</p>}
      </fieldset>

      <fieldset className="vm-section">
        <legend>ADD COPIES</legend>
        <p className="vm-hint">CURRENT COPIES: {total}. THIS CREATES NEW INDIVIDUAL COPY RECORDS FOR THIS TITLE — NO DUPLICATE TITLE IS CREATED.</p>
        {formats.length === 0 ? <span className="vm-yellow">NO FORMATS ENABLED. SEE STORE SETTINGS.</span> : (
          <AddCopiesForm titleId={t.id} formats={formats} categories={categories} formatDefaults={formatDefaults}
            initial={{ format: formats[0].value, categoryId: formatDefaults[formats[0].value] ?? categories[0]?.id ?? "", quantity: "1", replacementCost: store.settings!.replacementFee.toFixed(2) }} />
        )}
      </fieldset>
    </Screen>
  );
}

import Link from "next/link";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { posterUrl, searchMovies } from "@/lib/tmdb";

export const metadata = { title: "ADD TITLE" };

export default async function AddTitleSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const { user, store } = await requireStore();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const s = store.settings!;
  const yearLimit = s.onlyMoviesUpToStoreYear && s.storeYear && sp.all !== "1" ? s.storeYear : null;

  const result = q ? await searchMovies(q) : null;
  const all = result?.ok ? result.data : [];
  const shown = yearLimit ? all.filter((m) => m.year === null || m.year <= yearLimit) : all;
  const hidden = all.length - shown.length;
  const inStore = shown.length
    ? new Map((await db.movieTitle.findMany({ where: { storeId: store.id, tmdbId: { in: shown.map((m) => m.tmdbId) } }, select: { id: true, tmdbId: true } })).map((t) => [t.tmdbId, t.id]))
    : new Map<number | null, string>();

  return (
    <Screen title="ADD TITLE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>SEARCH MOVIE DATABASE</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href="/inventory/new" className="vm-btn">[ ADD MANUALLY ]</Link>
          <Link href="/inventory" className="vm-btn">[ INVENTORY ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <form action="/inventory/add" method="get" className="vm-searchbar" role="search">
        <div className="vm-field">
          <label htmlFor="q">SEARCH MOVIES</label>
          <input id="q" name="q" type="text" defaultValue={q} autoComplete="off" placeholder="E.G. TERMINATOR 2" />
        </div>
        {sp.all === "1" && <input type="hidden" name="all" value="1" />}
        <button type="submit" className="vm-btn">[ SEARCH ]</button>
      </form>

      {result && !result.ok && (
        <div className="vm-alert" role="alert">
          <strong>*** MOVIE DATABASE {result.reason === "not_configured" ? "NOT CONFIGURED" : "UNAVAILABLE"} ***</strong>
          {result.reason === "not_configured"
            ? "NO TMDB CREDENTIAL IS SET ON THE SERVER."
            : "THE EXTERNAL MOVIE DATABASE DID NOT RESPOND. TRY AGAIN LATER."}{" "}
          YOU CAN STILL ADD A TITLE BY HAND WITH [ ADD MANUALLY ].
        </div>
      )}
      {yearLimit && hidden > 0 && (
        <div className="vm-notice" role="status">
          *** {hidden} RESULT{hidden === 1 ? "" : "S"} HIDDEN: RELEASED AFTER STORE YEAR {yearLimit} ***
          {shown.length === 0 && <div>ALL RESULTS FOR THIS SEARCH ARE NEWER THAN YOUR STORE YEAR.</div>}
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <Link href={`/inventory/add?${new URLSearchParams({ q, all: "1" })}`} className="vm-btn small">[ SHOW ALL YEARS ]</Link>
          </div>
          <div className="vm-hint">TO TURN THIS FILTER OFF PERMANENTLY, UNCHECK IT UNDER STORE SETTINGS &gt; STORE ERA.</div>
        </div>
      )}
      {yearLimit && hidden === 0 && result?.ok && <p className="vm-hint">SHOWING MOVIES RELEASED ON OR BEFORE {yearLimit} (STORE YEAR FILTER IS ON).</p>}
      {sp.all === "1" && s.onlyMoviesUpToStoreYear && <p className="vm-hint">SHOWING ALL YEARS. <Link href={`/inventory/add?${new URLSearchParams({ q })}`}>APPLY STORE YEAR FILTER</Link></p>}

      {result?.ok && all.length === 0 && <div className="vm-notice" role="status">*** NO MOVIES FOUND FOR &quot;{q.toUpperCase()}&quot; ***</div>}
      {shown.length > 0 && (
        <div className="vm-tablewrap">
          <table className="vm-table rows">
            <caption className="vm-hint" style={{ textAlign: "left", paddingBottom: 4 }}>CLICK A MOVIE TO ADD IT TO INVENTORY</caption>
            <thead><tr><th scope="col">POSTER</th><th scope="col">TITLE</th><th scope="col">YEAR</th><th scope="col">IN STORE</th></tr></thead>
            <tbody>
              {shown.map((m) => {
                const poster = posterUrl(m.posterPath);
                return (
                  <tr key={m.tmdbId}>
                    <td>
                      {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poster} alt="" width={46} height={69} style={{ border: "1px solid var(--gray)" }} />
                      ) : (
                        <span className="vm-dim">—</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/inventory/new?tmdb=${m.tmdbId}`} className="vm-rowlink">{m.title.toUpperCase()}</Link>
                      <div className="vm-hint" style={{ maxWidth: 560 }}>{m.overview.slice(0, 140)}{m.overview.length > 140 ? "…" : ""}</div>
                    </td>
                    <td>{m.year ?? "—"}</td>
                    <td>{inStore.has(m.tmdbId) ? "YES" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Screen>
  );
}

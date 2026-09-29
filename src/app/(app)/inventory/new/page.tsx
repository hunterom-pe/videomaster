import Link from "next/link";
import { AddTitleForm } from "@/components/InventoryForms";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { categoryOptions, formatDefaultCategories, formatOptions } from "@/lib/inventory-options";
import { requireStore } from "@/lib/store-access";
import { getMovie, posterUrl } from "@/lib/tmdb";
import type { AddTitleValues } from "@/lib/validation";

export const metadata = { title: "ADD TITLE TO INVENTORY" };

export default async function NewTitlePage({ searchParams }: { searchParams: Promise<{ tmdb?: string }> }) {
  const { user, store } = await requireStore();
  const { tmdb } = await searchParams;
  const tmdbId = tmdb && /^\d{1,10}$/.test(tmdb) ? Number(tmdb) : null;
  const formats = formatOptions(store);
  const categories = categoryOptions(store);
  const formatDefaults = formatDefaultCategories(store);

  const blank: AddTitleValues = {
    title: "", year: "", director: "", runtime: "", genres: "", cast: "", rating: "", overview: "", tmdbId: "", posterPath: "",
    format: formats[0]?.value ?? "", categoryId: formatDefaults[formats[0]?.value ?? ""] ?? categories[0]?.id ?? "", quantity: "1", replacementCost: store.settings!.replacementFee.toFixed(2),
  };
  let initial = blank;
  let problem: string | null = null;
  let poster: string | null = null;

  if (tmdbId) {
    const r = await getMovie(tmdbId);
    if (r.ok) {
      const m = r.data;
      poster = posterUrl(m.posterPath, "w185");
      initial = {
        ...blank, title: m.title, year: m.year?.toString() ?? "", director: m.director, runtime: m.runtimeMinutes?.toString() ?? "",
        genres: m.genres.join(", "), cast: m.cast.join(", "), rating: m.rating, overview: m.overview,
        tmdbId: String(m.tmdbId), posterPath: m.posterPath ?? "",
      };
    } else {
      problem = r.reason === "not_configured" ? "MOVIE DATABASE NOT CONFIGURED." : "MOVIE DATABASE UNAVAILABLE.";
    }
  }
  const existing = tmdbId ? await db.movieTitle.findFirst({ where: { storeId: store.id, tmdbId }, select: { id: true, title: true } }) : null;

  return (
    <Screen title="ADD TITLE TO INVENTORY" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>ADD TITLE TO INVENTORY</h1>
      <hr className="vm-rule" />
      {formats.length === 0 && <div className="vm-alert" role="alert"><strong>*** NO FORMATS ENABLED ***</strong>ENABLE AT LEAST ONE FORMAT IN <Link href="/settings" style={{ color: "var(--yellow)" }}>STORE SETTINGS</Link>.</div>}
      {problem && <div className="vm-alert" role="alert"><strong>*** {problem} ***</strong>ENTER THE TITLE DETAILS BY HAND BELOW, OR <Link href={`/inventory/new?tmdb=${tmdbId}`} style={{ color: "var(--yellow)" }}>TRY AGAIN</Link>.</div>}
      {existing && (
        <div className="vm-notice" role="status">
          THIS MOVIE IS ALREADY IN YOUR STORE. SUBMITTING WILL ADD COPIES TO THE EXISTING TITLE (<Link href={`/inventory/${existing.id}`}>{existing.title.toUpperCase()}</Link>).
        </div>
      )}
      {poster && (
        <div style={{ marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt={`${initial.title} poster`} width={92} style={{ border: "2px solid var(--gray)" }} />
        </div>
      )}
      <AddTitleForm initial={initial} formats={formats} categories={categories} formatDefaults={formatDefaults} />
    </Screen>
  );
}

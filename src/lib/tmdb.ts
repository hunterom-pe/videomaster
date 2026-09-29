import "server-only";

// TMDB is called from the server only. The credential never reaches the browser.
const BASE = "https://api.themoviedb.org/3";

export type TmdbSearchResult = { tmdbId: number; title: string; year: number | null; posterPath: string | null; overview: string };
export type TmdbMovie = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  director: string;
  runtimeMinutes: number | null;
  genres: string[];
  cast: string[];
  rating: string;
};
export type TmdbResult<T> = { ok: true; data: T } | { ok: false; reason: "not_configured" | "unavailable" };

async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<unknown | null> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) throw new Error("not_configured");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!token && key) url.searchParams.set("api_key", key);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tmdb_${res.status}`);
  return res.json();
}

const yearOf = (date: unknown) => (typeof date === "string" && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);

async function guarded<T>(fn: () => Promise<T>): Promise<TmdbResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.message === "not_configured" ? "not_configured" : "unavailable" };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function searchMovies(query: string): Promise<TmdbResult<TmdbSearchResult[]>> {
  return guarded(async () => {
    const json = (await tmdbFetch("/search/movie", { query, include_adult: "false", language: "en-US", page: "1" })) as any;
    return (json.results ?? []).slice(0, 20).map((r: any) => ({
      tmdbId: Number(r.id),
      title: String(r.title ?? ""),
      year: yearOf(r.release_date),
      posterPath: typeof r.poster_path === "string" ? r.poster_path : null,
      overview: String(r.overview ?? ""),
    }));
  });
}

export function getMovie(tmdbId: number): Promise<TmdbResult<TmdbMovie>> {
  return guarded(async () => {
    const m = (await tmdbFetch(`/movie/${tmdbId}`, { append_to_response: "credits,release_dates", language: "en-US" })) as any;
    const us = (m.release_dates?.results ?? []).find((r: any) => r.iso_3166_1 === "US");
    const rating = (us?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) ?? "";
    return {
      tmdbId: Number(m.id),
      title: String(m.title ?? ""),
      year: yearOf(m.release_date),
      posterPath: typeof m.poster_path === "string" ? m.poster_path : null,
      overview: String(m.overview ?? ""),
      director: (m.credits?.crew ?? []).filter((c: any) => c.job === "Director").map((c: any) => c.name).join(", "),
      runtimeMinutes: typeof m.runtime === "number" && m.runtime > 0 ? m.runtime : null,
      genres: (m.genres ?? []).map((g: any) => String(g.name)),
      cast: (m.credits?.cast ?? []).slice(0, 6).map((c: any) => String(c.name)),
      rating: String(rating),
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const posterUrl = (path: string | null | undefined, size: "w92" | "w185" = "w92") =>
  path && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;

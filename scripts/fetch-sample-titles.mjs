// One-time generator for src/lib/sample-titles.json (real TMDB metadata for the demo store).
// Usage: node scripts/fetch-sample-titles.mjs   (needs TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN in .env)
import "dotenv/config";
import { writeFileSync } from "node:fs";

const LIST = [
  ["Terminator 2: Judgment Day", 1991], ["Alien", 1979], ["Aliens", 1986], ["Jurassic Park", 1993], ["The Matrix", 1999],
  ["Toy Story", 1995], ["Pulp Fiction", 1994], ["Forrest Gump", 1994], ["Die Hard", 1988], ["Back to the Future", 1985],
  ["Ghostbusters", 1984], ["Home Alone", 1990], ["Aladdin", 1992], ["The Lion King", 1994], ["Jaws", 1975],
  ["Groundhog Day", 1993], ["The Silence of the Lambs", 1991], ["Braveheart", 1995], ["Independence Day", 1996], ["Speed", 1994],
  ["Clueless", 1995], ["Mrs. Doubtfire", 1993], ["The Fugitive", 1993], ["Beauty and the Beast", 1991], ["Ferris Bueller's Day Off", 1986],
  ["Wayne's World", 1992], ["Fargo", 1996], ["Twister", 1996],
];

const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
const key = process.env.TMDB_API_KEY?.trim();
if (!token && !key) throw new Error("No TMDB credential in .env");

async function tmdb(path, params = {}) {
  const url = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!token) url.searchParams.set("api_key", key);
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const out = [];
for (const [title, year] of LIST) {
  const search = await tmdb("/search/movie", { query: title, year: String(year) });
  const hit = search.results.find((r) => r.title.toLowerCase() === title.toLowerCase()) ?? search.results[0];
  if (!hit) { console.log("NOT FOUND", title); continue; }
  const m = await tmdb(`/movie/${hit.id}`, { append_to_response: "credits,release_dates" });
  const us = (m.release_dates?.results ?? []).find((r) => r.iso_3166_1 === "US");
  const rating = (us?.release_dates ?? []).map((d) => d.certification).find(Boolean) ?? "";
  out.push({
    tmdbId: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : year,
    overview: m.overview ?? "",
    posterPath: m.poster_path ?? null,
    director: (m.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name).join(", "),
    runtimeMinutes: m.runtime > 0 ? m.runtime : null,
    genres: (m.genres ?? []).map((g) => g.name),
    cast: (m.credits?.cast ?? []).slice(0, 6).map((c) => c.name),
    rating,
  });
  console.log(String(out.length).padStart(2), m.title, m.release_date?.slice(0, 4), `#${m.id}`, rating || "NR");
}
writeFileSync("src/lib/sample-titles.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} titles`);

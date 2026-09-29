import "server-only";
import type { CopyStatus, MediaFormat, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const INVENTORY_PAGE_SIZE = 20;
export const FORMAT_CODES: Record<MediaFormat, string> = {
  VHS: "VHS", DVD: "DVD", BLURAY: "BD", LASERDISC: "LD", VIDEO_GAME: "GAME", OTHER: "OTH",
};
export const FORMAT_LABELS: Record<MediaFormat, string> = {
  VHS: "VHS", DVD: "DVD", BLURAY: "BLU-RAY", LASERDISC: "LASERDISC", VIDEO_GAME: "VIDEO GAME", OTHER: "OTHER",
};
const OUT: CopyStatus[] = ["RENTED", "OVERDUE"];

export type InventoryFilters = { q: string; format: string; categoryId: string; availability: string };

export function titleSearchWhere(storeId: string, f: InventoryFilters): Prisma.MovieTitleWhereInput {
  const terms = f.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const copyFilter: Prisma.InventoryCopyWhereInput = {};
  if (f.format in FORMAT_CODES) copyFilter.format = f.format as MediaFormat;
  if (f.categoryId) copyFilter.rentalCategoryId = f.categoryId;
  if (f.availability === "available") copyFilter.status = "AVAILABLE";
  if (f.availability === "out") copyFilter.status = { in: OUT };

  return {
    storeId,
    ...(Object.keys(copyFilter).length ? { copies: { some: copyFilter } } : {}),
    AND: terms.map((t) => ({
      OR: [
        { title: { contains: t, mode: "insensitive" as const } },
        { searchText: { contains: t.toLowerCase() } },
        ...(/^\d{4}$/.test(t) ? [{ year: Number(t) }] : []),
        { copies: { some: { OR: [{ copyNumber: { contains: t, mode: "insensitive" as const } }, { barcode: t }] } } },
      ],
    })),
  };
}

export async function searchTitles(storeId: string, f: InventoryFilters, page: number) {
  const where = titleSearchWhere(storeId, f);
  const [titles, total] = await Promise.all([
    db.movieTitle.findMany({ where, orderBy: [{ title: "asc" }, { year: "asc" }], skip: (page - 1) * INVENTORY_PAGE_SIZE, take: INVENTORY_PAGE_SIZE }),
    db.movieTitle.count({ where }),
  ]);
  const groups = titles.length
    ? await db.inventoryCopy.groupBy({
        by: ["movieTitleId", "format", "status"],
        where: { storeId, movieTitleId: { in: titles.map((t) => t.id) } },
        _count: { _all: true },
      })
    : [];
  return { titles, total, pages: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)), groups };
}

export type FormatSummary = { format: MediaFormat; total: number; available: number; out: number; damaged: number; lost: number };

/** Roll grouped counts up to per-format summaries. RETIRED copies are excluded from totals. */
export function summarize(groups: { format: MediaFormat; status: CopyStatus; _count: { _all: number } }[]): FormatSummary[] {
  const map = new Map<MediaFormat, FormatSummary>();
  for (const g of groups) {
    if (g.status === "RETIRED") continue;
    const s = map.get(g.format) ?? { format: g.format, total: 0, available: 0, out: 0, damaged: 0, lost: 0 };
    const n = g._count._all;
    s.total += n;
    if (g.status === "AVAILABLE") s.available += n;
    else if (OUT.includes(g.status)) s.out += n;
    else if (g.status === "LOST") s.lost += n;
    else s.damaged += n; // DAMAGED + REPAIR
    map.set(g.format, s);
  }
  return [...map.values()];
}

export const buildSearchText = (director: string, genres: string[], cast: string[]) =>
  [director, ...genres, ...cast].join(" ").toLowerCase();

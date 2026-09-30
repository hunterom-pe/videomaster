import "server-only";
import type { CartItem } from "@/actions/rentals";
import { copyInclude, toCartItem } from "@/lib/cart-items";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";

/**
 * "Rent again": for a past rental (or all rentals on a past transaction), find an AVAILABLE copy of the same title
 * and format, and return it as a ready cart line. Titles with no copy on the shelf are reported, not silently skipped.
 */
export async function rentAgainItems(storeId: string, customerId: string, source: { rentalId?: string; transactionId?: string }) {
  const past = await db.rental.findMany({
    where: { storeId, customerId, ...(source.rentalId ? { id: source.rentalId } : { transactionId: source.transactionId ?? "none" }) },
    include: { copy: { select: { movieTitleId: true, format: true, movieTitle: { select: { title: true } } } } },
    orderBy: { rentedAt: "asc" }, take: 20,
  });
  const items: CartItem[] = [];
  const missing: string[] = [];
  const used = new Set<string>();
  for (const r of past) {
    const copy = await db.inventoryCopy.findFirst({
      where: { storeId, movieTitleId: r.copy.movieTitleId, format: r.copy.format, status: "AVAILABLE", id: { notIn: [...used] }, rentalCategoryId: { not: null } },
      orderBy: { copyNumber: "asc" }, include: copyInclude,
    });
    const item = copy ? toCartItem(copy) : null;
    if (item) { items.push(item); used.add(item.copyId); }
    else missing.push(`${r.copy.movieTitle.title.toUpperCase()} (${FORMAT_LABELS[r.copy.format]})`);
  }
  return { items, missing, found: past.length };
}

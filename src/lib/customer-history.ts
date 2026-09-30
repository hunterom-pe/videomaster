import "server-only";
import { db } from "@/lib/db";
import { toCents } from "@/lib/pricing";

export const HISTORY_PAGE_SIZE = 25;
const cents = (d: { toString(): string } | null | undefined) => (d ? toCents(d) : 0);

/** Lifetime figures for one customer. Voided transactions never count (their rentals no longer exist). */
export async function customerStats(storeId: string, customerId: string) {
  const live = { storeId, customerId, voidedAt: null };
  const [rentals, out, lateReturns, lost, damaged, spent, dates, favorites] = await Promise.all([
    db.rental.count({ where: { storeId, customerId } }),
    db.rental.count({ where: { storeId, customerId, returnedAt: null } }),
    db.rental.count({ where: { storeId, customerId, chargedLateFee: { gt: 0 } } }),
    db.rental.count({ where: { storeId, customerId, outcome: "LOST" } }),
    db.rental.count({ where: { storeId, customerId, outcome: "DAMAGED" } }),
    db.transaction.aggregate({ where: live, _sum: { total: true }, _count: { _all: true } }),
    db.transaction.aggregate({ where: live, _min: { createdAt: true }, _max: { createdAt: true } }),
    db.$queryRaw<{ id: string; title: string; year: number | null; n: bigint }[]>`
      SELECT t.id, t.title, t.year, count(*) AS n
      FROM "Rental" r
      JOIN "InventoryCopy" c ON c."storeId" = r."storeId" AND c.id = r."copyId"
      JOIN "MovieTitle" t ON t."storeId" = c."storeId" AND t.id = c."movieTitleId"
      WHERE r."storeId" = ${storeId} AND r."customerId" = ${customerId}
      GROUP BY t.id, t.title, t.year
      ORDER BY n DESC, t.title ASC
      LIMIT 3`,
  ]);
  return {
    rentals, out, lateReturns, lost, damaged,
    transactions: spent._count._all,
    netSpentCents: cents(spent._sum.total), // everything paid, net of refunds
    firstVisit: dates._min.createdAt,
    lastVisit: dates._max.createdAt,
    favorites: favorites.map((f) => ({ id: f.id, title: f.title, year: f.year, count: Number(f.n) })),
  };
}

export async function rentalHistory(storeId: string, customerId: string, page: number) {
  const where = { storeId, customerId };
  const [rows, total] = await Promise.all([
    db.rental.findMany({
      where, orderBy: { rentedAt: "desc" }, skip: (page - 1) * HISTORY_PAGE_SIZE, take: HISTORY_PAGE_SIZE,
      include: { copy: { select: { copyNumber: true, movieTitleId: true, movieTitle: { select: { title: true, year: true } } } } },
    }),
    db.rental.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)) };
}

export async function transactionHistory(storeId: string, customerId: string, page: number) {
  const where = { storeId, customerId };
  const [rows, total] = await Promise.all([
    db.transaction.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * HISTORY_PAGE_SIZE, take: HISTORY_PAGE_SIZE,
      select: { id: true, number: true, type: true, createdAt: true, total: true, paymentMethod: true, voidedAt: true, balanceChange: true },
    }),
    db.transaction.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)) };
}

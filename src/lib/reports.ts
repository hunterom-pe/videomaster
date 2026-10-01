import "server-only";
import { db } from "@/lib/db";
import { listOverdue, overdueWhere } from "@/lib/overdue";
import { toCents } from "@/lib/pricing";
import type { Range } from "@/lib/report-range";

const cents = (d: { toString(): string } | null | undefined) => (d ? toCents(d) : 0);

/** Daily activity for one store-local day (day..next are the zone-aware boundaries). */
export async function dailyActivity(storeId: string, day: Date, next: Date) {
  const between = { gte: day, lt: next };
  const live = { voidedAt: null }; // voided transactions never count
  const revenueTx = { ...live, type: { not: "STORE_CREDIT_SALE" as const } }; // credit sold is a liability, not revenue
  const [rentals, returns, txCount, sales, txTotal, returned, refunds, acct, creditSold] = await Promise.all([
    db.rental.count({ where: { storeId, rentedAt: between } }),
    db.rental.count({ where: { storeId, returnedAt: between } }),
    db.transaction.count({ where: { storeId, createdAt: between, ...revenueTx } }),
    db.transactionItem.aggregate({ where: { storeId, transaction: { createdAt: between, type: { not: "REFUND" }, ...live } }, _sum: { lineTotal: true, quantity: true } }),
    db.transaction.aggregate({ where: { storeId, createdAt: between, ...revenueTx }, _sum: { total: true, tax: true } }),
    db.rental.aggregate({ where: { storeId, returnedAt: between }, _sum: { chargedLateFee: true, otherFee: true, rewindFee: true } }),
    db.transaction.aggregate({ where: { storeId, type: "REFUND", createdAt: between, ...live }, _sum: { subtotal: true }, _count: { _all: true } }),
    db.transaction.groupBy({ by: ["type"], where: { storeId, createdAt: between, ...live, balanceChange: { not: 0 } }, _sum: { balanceChange: true, total: true } }),
    db.transaction.groupBy({ by: ["type"], where: { storeId, createdAt: between, ...live, creditChange: { not: 0 } }, _sum: { creditChange: true } }),
  ]);
  const creditSum = (pred: (type: string, v: number) => boolean) => creditSold.reduce((n, g) => (pred(g.type, cents(g._sum.creditChange)) ? n + cents(g._sum.creditChange) : n), 0);
  const acctSum = (type: string, key: "balanceChange" | "total") => cents(acct.find((g) => g.type === type)?._sum[key]);
  const rentalRevenue = await db.rental.aggregate({ where: { storeId, rentedAt: between }, _sum: { price: true } });
  const membership = await db.transaction.aggregate({ where: { storeId, type: "MEMBERSHIP_FEE", createdAt: between, ...live }, _sum: { total: true } });
  return {
    refundCount: refunds._count._all,
    refundCents: cents(refunds._sum.subtotal), // negative, before tax
    creditSoldCents: creditSum((t) => t === "STORE_CREDIT_SALE"),
    creditRefundedCents: creditSum((t, v) => t === "REFUND" && v > 0),
    creditUsedCents: -creditSum((t, v) => t !== "STORE_CREDIT_SALE" && v < 0),
    onAccountCents: acctSum("RETURN", "balanceChange"), // fees put on account that day
    accountPaymentCents: acctSum("ACCOUNT_PAYMENT", "total"),
    waivedCents: -acctSum("FEE_WAIVER", "balanceChange"),
    rentals, returns, transactions: txCount,
    merchandiseUnits: sales._sum.quantity ?? 0,
    merchandiseCents: cents(sales._sum.lineTotal),
    rentalCents: cents(rentalRevenue._sum.price),
    lateFeeCents: cents(returned._sum.chargedLateFee),
    otherFeeCents: cents(returned._sum.otherFee),
    rewindFeeCents: cents(returned._sum.rewindFee),
    membershipCents: cents(membership._sum.total),
    taxCents: cents(txTotal._sum.tax),
    totalCents: cents(txTotal._sum.total),
  };
}

/** Revenue over a date range. total = rentals + merchandise + fees (return + membership + account payments) + refunds (negative) + tax (net of refunded tax). */
export async function revenue(storeId: string, r: Range) {
  const between = { gte: r.from, lt: r.toExclusive };
  const live = { voidedAt: null }; // voided transactions never count
  const revenueTx = { ...live, type: { not: "STORE_CREDIT_SALE" as const } }; // credit sold is a liability, not revenue
  const [rent, merch, fees, refunds, all, credit] = await Promise.all([
    db.rental.aggregate({ where: { storeId, transaction: { createdAt: between, ...live } }, _sum: { price: true }, _count: { _all: true } }),
    db.transactionItem.aggregate({ where: { storeId, transaction: { createdAt: between, type: { not: "REFUND" }, ...live } }, _sum: { lineTotal: true } }),
    db.transaction.aggregate({ where: { storeId, type: { in: ["RETURN", "MEMBERSHIP_FEE", "ACCOUNT_PAYMENT"] }, createdAt: between, ...live }, _sum: { total: true }, _count: { _all: true } }),
    db.transaction.aggregate({ where: { storeId, type: "REFUND", createdAt: between, ...live }, _sum: { subtotal: true }, _count: { _all: true } }),
    db.transaction.aggregate({ where: { storeId, createdAt: between, ...revenueTx }, _sum: { tax: true, total: true }, _count: { _all: true } }),
    db.transaction.groupBy({ by: ["type"], where: { storeId, createdAt: between, ...live, creditChange: { not: 0 } }, _sum: { creditChange: true } }),
  ]);
  const creditSum = (pred: (type: string, v: number) => boolean) => credit.reduce((n, g) => (pred(g.type, cents(g._sum.creditChange)) ? n + cents(g._sum.creditChange) : n), 0);
  const byPayment = await db.transaction.groupBy({ by: ["paymentMethod"], where: { storeId, createdAt: between, ...revenueTx }, _sum: { total: true }, _count: { _all: true }, orderBy: { paymentMethod: "asc" } });
  return {
    rentalCents: cents(rent._sum.price),
    merchandiseCents: cents(merch._sum.lineTotal),
    feeCents: cents(fees._sum.total),
    refundCents: cents(refunds._sum.subtotal), // negative, before tax
    refundCount: refunds._count._all,
    creditSoldCents: creditSum((t) => t === "STORE_CREDIT_SALE"),
    creditRefundedCents: creditSum((t, v) => t === "REFUND" && v > 0),
    creditUsedCents: -creditSum((t, v) => t !== "STORE_CREDIT_SALE" && v < 0),
    taxCents: cents(all._sum.tax),
    totalCents: cents(all._sum.total),
    transactions: all._count._all,
    byPayment: byPayment.map((p) => ({ method: p.paymentMethod, count: p._count._all, totalCents: cents(p._sum.total) })),
  };
}

/** Titles ranked by number of rentals started in the range. */
export async function popularRentals(storeId: string, r: Range, limit = 25) {
  const rows = await db.$queryRaw<{ id: string; title: string; year: number | null; n: bigint }[]>`
    SELECT t.id, t.title, t.year, count(*) AS n
    FROM "Rental" r
    JOIN "InventoryCopy" c ON c."storeId" = r."storeId" AND c.id = r."copyId"
    JOIN "MovieTitle" t ON t."storeId" = c."storeId" AND t.id = c."movieTitleId"
    WHERE r."storeId" = ${storeId} AND r."rentedAt" >= ${r.from} AND r."rentedAt" < ${r.toExclusive}
    GROUP BY t.id, t.title, t.year
    ORDER BY n DESC, t.title ASC
    LIMIT ${limit}`;
  return rows.map((x) => ({ id: x.id, title: x.title, year: x.year, count: Number(x.n) }));
}

/** Top customers by number of rentals started in the range. */
export async function topCustomers(storeId: string, r: Range, limit = 25) {
  const groups = await db.rental.groupBy({
    by: ["customerId"],
    where: { storeId, rentedAt: { gte: r.from, lt: r.toExclusive } },
    _count: { _all: true },
    _sum: { price: true },
    orderBy: [{ _count: { customerId: "desc" } }],
    take: limit,
  });
  const customers = await db.customer.findMany({ where: { storeId, id: { in: groups.map((g) => g.customerId) } }, select: { id: true, firstName: true, lastName: true, membershipNumber: true } });
  return groups.map((g) => {
    const c = customers.find((x) => x.id === g.customerId);
    return { id: g.customerId, name: c ? `${c.lastName.toUpperCase()}, ${c.firstName.toUpperCase()}` : "UNKNOWN", member: c?.membershipNumber ?? "", count: g._count._all, spentCents: cents(g._sum.price) };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Copy counts by status (with derived overdue), overall and by format. */
export async function inventorySummary(storeId: string, tz: string) {
  const [titles, groups, overdueRentals] = await Promise.all([
    db.movieTitle.count({ where: { storeId } }),
    db.inventoryCopy.groupBy({ by: ["format", "status"], where: { storeId }, _count: { _all: true } }),
    db.rental.findMany({ where: overdueWhere(storeId, tz), select: { copy: { select: { format: true } } } }),
  ]);
  const overdueByFormat = new Map<string, number>();
  for (const r of overdueRentals) overdueByFormat.set(r.copy.format, (overdueByFormat.get(r.copy.format) ?? 0) + 1);
  type Row = { format: string; total: number; available: number; rented: number; overdue: number; damaged: number; lost: number; retired: number };
  const map = new Map<string, Row>();
  for (const g of groups) {
    const row = map.get(g.format) ?? { format: g.format, total: 0, available: 0, rented: 0, overdue: overdueByFormat.get(g.format) ?? 0, damaged: 0, lost: 0, retired: 0 };
    const n = g._count._all;
    if (g.status === "RETIRED") row.retired += n;
    else {
      row.total += n;
      if (g.status === "AVAILABLE") row.available += n;
      else if (g.status === "RENTED" || g.status === "OVERDUE") row.rented += n;
      else if (g.status === "LOST") row.lost += n;
      else row.damaged += n;
    }
    map.set(g.format, row);
  }
  const rows = [...map.values()].sort((a, b) => a.format.localeCompare(b.format));
  const sum = (k: keyof Row) => rows.reduce((n, r) => n + (r[k] as number), 0);
  return {
    titles, rows,
    totals: { total: sum("total"), available: sum("available"), rented: sum("rented"), overdue: sum("overdue"), damaged: sum("damaged"), lost: sum("lost"), retired: sum("retired") },
  };
}

export async function merchandiseInventory(storeId: string) {
  const items = await db.concessionItem.findMany({ where: { storeId, active: true }, orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }], take: 2000, include: { category: { select: { name: true } } } });
  const out = items.filter((i) => i.quantityOnHand <= 0);
  const low = items.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand <= i.lowStockThreshold);
  const units = items.reduce((n, i) => n + i.quantityOnHand, 0);
  const retailValueCents = items.reduce((n, i) => n + toCents(i.retailPrice) * i.quantityOnHand, 0);
  return { items, outCount: out.length, lowCount: low.length, units, retailValueCents };
}

/** Customers who owe money, largest balance first. */
export async function customerBalances(storeId: string) {
  const credit = await db.customer.aggregate({ where: { storeId }, _sum: { storeCredit: true } });
  const rows = await db.customer.findMany({
    where: { storeId, outstandingFees: { gt: 0 } }, orderBy: [{ outstandingFees: "desc" }, { lastName: "asc" }], take: 1000,
    select: { id: true, firstName: true, lastName: true, membershipNumber: true, phone: true, outstandingFees: true },
  });
  const list = rows.map((c) => ({ id: c.id, name: `${c.lastName.toUpperCase()}, ${c.firstName.toUpperCase()}`, member: c.membershipNumber, phone: c.phone, cents: cents(c.outstandingFees) }));
  return { rows: list, totalCents: list.reduce((n, r) => n + r.cents, 0), creditOutstandingCents: cents(credit._sum.storeCredit) };
}

export { listOverdue };

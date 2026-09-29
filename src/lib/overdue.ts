import "server-only";
import type { CustomerStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { accruedLateFeeCents, daysLate, startOfUtcDay } from "@/lib/late-fees";
import { toCents } from "@/lib/pricing";

/** Overdue = unreturned and due before today (UTC). Derived on read, so it can never go stale. */
export const overdueWhere = (storeId: string, now = new Date()) => ({ storeId, returnedAt: null, dueAt: { lt: startOfUtcDay(now) } });

export type OverdueRow = {
  rentalId: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  titleId: string;
  title: string;
  copyNumber: string;
  dueAt: Date;
  daysLate: number;
  feeCents: number; // accrued late fee on this rental
  balanceCents: number; // customer's total accrued late fees + outstanding fees
};

const MAX_ROWS = 5000;

export async function listOverdue(storeId: string, now = new Date()) {
  const rentals = await db.rental.findMany({
    where: overdueWhere(storeId, now),
    orderBy: { dueAt: "asc" },
    take: MAX_ROWS,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, outstandingFees: true } },
      copy: { select: { copyNumber: true, movieTitleId: true, movieTitle: { select: { title: true } }, rentalCategory: { select: { lateFeePerDay: true, maxLateFee: true } } } },
    },
  });
  const perCustomer = new Map<string, number>();
  const rows = rentals.map((r) => {
    const cat = r.copy.rentalCategory;
    const feeCents = cat ? accruedLateFeeCents(r.dueAt, now, toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null) : 0;
    perCustomer.set(r.customerId, (perCustomer.get(r.customerId) ?? 0) + feeCents);
    return { r, feeCents };
  });
  const out: OverdueRow[] = rows.map(({ r, feeCents }) => ({
    rentalId: r.id,
    customerId: r.customerId,
    customerName: `${r.customer.lastName.toUpperCase()}, ${r.customer.firstName.toUpperCase()}`,
    phone: r.customer.phone,
    titleId: r.copy.movieTitleId,
    title: r.copy.movieTitle.title,
    copyNumber: r.copy.copyNumber,
    dueAt: r.dueAt,
    daysLate: daysLate(r.dueAt, now),
    feeCents,
    balanceCents: (perCustomer.get(r.customerId) ?? 0) + toCents(r.customer.outstandingFees),
  }));
  // Worst first: most days late, then oldest due.
  out.sort((a, b) => b.daysLate - a.daysLate || a.customerName.localeCompare(b.customerName));
  return { rows: out, capped: rentals.length === MAX_ROWS };
}

/** Overdue rental counts for a set of customers (one query). */
export async function overdueCounts(storeId: string, customerIds: string[], now = new Date()): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const groups = await db.rental.groupBy({ by: ["customerId"], where: { ...overdueWhere(storeId, now), customerId: { in: customerIds } }, _count: { _all: true } });
  return new Map(groups.map((g) => [g.customerId, g._count._all]));
}

/** GOOD accounts with overdue rentals behave as OVERDUE; manually-set statuses (BLOCKED, SUSPENDED, ...) always win. */
export const effectiveStatus = (status: CustomerStatus, overdueCount: number): CustomerStatus =>
  status === "GOOD" && overdueCount > 0 ? "OVERDUE" : status;

import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { resolvePaidNow } from "@/lib/balance";
import { resolveTender } from "@/lib/cash";
import { daysLate, lateFeeCents } from "@/lib/late-fees";
import { fmtMoney, fromCents, toCents } from "@/lib/pricing";

// "Return all": several of one customer's open rentals come back in a single step, as ONE RETURN transaction.
// Every video is a normal return (no damage/loss/rewind fee; use the single-return screen for those). The late fee
// per video follows store policy and can be waived for all of them. Plain function over a database transaction.

type Tx = Prisma.TransactionClient;
export class ReturnBatchError extends Error {}

export type OpenRentalFee = { rentalId: string; calcCents: number; days: number };

const rentalInclude = { copy: { include: { movieTitle: { select: { title: true } }, rentalCategory: true } } } satisfies Prisma.RentalInclude;
export type OpenRental = Prisma.RentalGetPayload<{ include: typeof rentalInclude }>;

export const lateFeeFor = (r: OpenRental, now: Date, tz: string): OpenRentalFee => {
  const cat = r.copy.rentalCategory;
  const days = daysLate(r.dueAt, now, tz);
  const calcCents = cat ? lateFeeCents(days, toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null) : 0;
  return { rentalId: r.id, calcCents, days };
};

export async function openRentalsFor(tx: Tx | { rental: Tx["rental"] }, storeId: string, customerId: string, ids?: string[]) {
  return tx.rental.findMany({
    where: { storeId, customerId, returnedAt: null, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { dueAt: "asc" }, include: rentalInclude,
  });
}

export async function returnRentals(
  tx: Tx,
  o: { storeId: string; userId: string; customerId: string; rentalIds: string[]; waiveLate: boolean; method: PaymentMethod; paidRaw?: string; tenderedRaw?: string; tz: string; now: Date },
) {
  if (o.rentalIds.length === 0) throw new ReturnBatchError("SELECT AT LEAST ONE VIDEO TO RETURN.");
  const rentals = await openRentalsFor(tx, o.storeId, o.customerId, o.rentalIds);
  if (rentals.length !== new Set(o.rentalIds).size) throw new ReturnBatchError("ONE OR MORE VIDEOS WERE NOT FOUND OR HAVE ALREADY BEEN RETURNED. RELOAD AND TRY AGAIN.");

  const lines = rentals.map((r) => {
    const fee = lateFeeFor(r, o.now, o.tz);
    return { r, calc: fee.calcCents, charged: o.waiveLate ? 0 : fee.calcCents };
  });
  const total = lines.reduce((n, l) => n + l.charged, 0);
  const calcTotal = lines.reduce((n, l) => n + l.calc, 0);
  const split = resolvePaidNow(total, o.paidRaw);
  if (!split.ok) throw new ReturnBatchError(split.message);
  const tender = resolveTender(o.method, split.paidCents, o.tenderedRaw);
  if (!tender.ok) throw new ReturnBatchError(tender.message);

  const { nextTransactionNumber } = await tx.store.update({ where: { id: o.storeId }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
  const notes = [
    `RETURNED ${rentals.length} VIDEO${rentals.length === 1 ? "" : "S"}`,
    o.waiveLate && calcTotal > 0 ? `LATE FEES ${fmtMoney(calcTotal)} WAIVED` : null,
    split.unpaidCents > 0 ? `${fmtMoney(split.unpaidCents)} OF ${fmtMoney(total)} FEES PUT ON ACCOUNT` : null,
  ].filter(Boolean).join("; ");
  const transaction = await tx.transaction.create({
    data: {
      storeId: o.storeId, number: nextTransactionNumber - 1, type: "RETURN", customerId: o.customerId, createdById: o.userId,
      // subtotal/total = money collected now; the unpaid part is recorded in balanceChange
      subtotal: fromCents(split.paidCents), tax: "0.00", total: fromCents(split.paidCents), balanceChange: fromCents(split.unpaidCents),
      paymentMethod: o.method, tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents), notes,
    },
  });

  for (const l of lines) {
    // Guarded close: only one concurrent return can win each rental.
    const closed = await tx.rental.updateMany({
      where: { id: l.r.id, storeId: o.storeId, returnedAt: null },
      data: { returnedAt: o.now, outcome: "RETURNED", calculatedLateFee: fromCents(l.calc), chargedLateFee: fromCents(l.charged), returnTransactionId: transaction.id },
    });
    if (closed.count !== 1) throw new ReturnBatchError("A VIDEO WAS JUST RETURNED BY ANOTHER CLERK. RELOAD AND TRY AGAIN.");
  }
  await tx.inventoryCopy.updateMany({ where: { storeId: o.storeId, id: { in: rentals.map((r) => r.copyId) } }, data: { status: "AVAILABLE" } });
  if (split.unpaidCents > 0)
    await tx.customer.update({ where: { id: o.customerId, storeId: o.storeId }, data: { outstandingFees: { increment: fromCents(split.unpaidCents) } } });
  return { transactionId: transaction.id, count: rentals.length, totalCents: total, paidCents: split.paidCents };
}

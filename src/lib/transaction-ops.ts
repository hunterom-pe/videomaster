import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { addCredit } from "@/lib/credit-ops";
import { fromCents, toCents } from "@/lib/pricing";
import { refundTotals, type RefundLine } from "@/lib/refunds";

// Voids and refunds. These are plain functions over a database transaction (no session), so the server actions
// and the automated tests share exactly the same code. Callers are responsible for authentication and role checks.
//
// VOID   = an entire rental / merchandise sale that never should have happened: its rentals are removed, the copies
//          go back on the shelf, stock is restocked, and the transaction stays in history marked VOID (excluded from
//          every total). Only possible while nothing has been returned or refunded.
// REFUND = money back after the fact. Creates a negative REFUND transaction linked to the original (merchandise lines
//          with optional restock, rental charges, or a whole fee/membership payment), with proportional tax.

type Tx = Prisma.TransactionClient;
export class TransactionOpError extends Error {}

export const originalInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, membershipNumber: true } },
  rentals: { orderBy: { rentedAt: "asc" as const }, include: { copy: { include: { movieTitle: true, rentalCategory: true } } } },
  items: { where: { kind: "MERCHANDISE" as const, quantity: { gt: 0 } }, orderBy: { description: "asc" as const } },
  refunds: { where: { voidedAt: null }, include: { items: true } },
  voidedBy: { select: { email: true } },
} satisfies Prisma.TransactionInclude;
export type OriginalTransaction = Prisma.TransactionGetPayload<{ include: typeof originalInclude }>;

export const loadOriginal = (tx: Tx | Prisma.TransactionClient, storeId: string, transactionId: string) =>
  tx.transaction.findFirst({ where: { id: transactionId, storeId }, include: originalInclude });

const VOIDABLE = ["RENTAL", "RETAIL_SALE"] as const;
const REFUNDABLE = ["RENTAL", "RETAIL_SALE", "RETURN", "MEMBERSHIP_FEE"] as const;
const FEE_TYPES = ["RETURN", "MEMBERSHIP_FEE"] as const;
const isIn = <T extends readonly string[]>(list: T, v: string): v is T[number] => (list as readonly string[]).includes(v);

/** Why this transaction cannot be voided, or null if it can. */
export function voidBlocker(t: OriginalTransaction): string | null {
  if (t.voidedAt) return "THIS TRANSACTION IS ALREADY VOIDED.";
  if (!isIn(VOIDABLE, t.type)) return "ONLY RENTAL AND MERCHANDISE-SALE TRANSACTIONS CAN BE VOIDED. USE REFUND FOR OTHER TYPES.";
  if (t.refunds.length > 0) return "THIS TRANSACTION HAS A REFUND AND CANNOT BE VOIDED.";
  if (t.rentals.some((r) => r.returnedAt)) return "A VIDEO FROM THIS RENTAL HAS ALREADY BEEN RETURNED. USE REFUND INSTEAD.";
  return null;
}

export type Refundability = {
  merchandise: { id: string; sku: string; description: string; unitCents: number; remaining: number; taxable: boolean }[];
  rentals: { id: string; label: string; cents: number; taxable: boolean; copyStatus: string; returned: boolean }[];
  fee: { label: string; cents: number } | null;
  originalTaxCents: number;
  originalTaxableBaseCents: number;
  remainingTaxCents: number;
  anything: boolean;
};

/** Everything that can still be refunded on a transaction, plus the tax bookkeeping needed to price a refund. */
export function refundability(t: OriginalTransaction): Refundability {
  const empty: Refundability = { merchandise: [], rentals: [], fee: null, originalTaxCents: 0, originalTaxableBaseCents: 0, remainingTaxCents: 0, anything: false };
  if (t.voidedAt || !isIn(REFUNDABLE, t.type)) return empty;

  const merchandise = t.items
    .map((i) => ({ id: i.id, sku: i.sku, description: i.description, unitCents: toCents(i.unitPrice), remaining: i.quantity - i.refundedQty, taxable: i.taxable }))
    .filter((i) => i.remaining > 0);
  const rentals = t.rentals
    .filter((r) => !r.refundedAt)
    .map((r) => ({
      id: r.id, label: `${r.copy.movieTitle.title.toUpperCase()} [${r.copy.copyNumber}]`, cents: toCents(r.price),
      taxable: r.copy.rentalCategory?.taxable ?? true, copyStatus: r.copy.status, returned: !!r.returnedAt,
    }));
  // A return whose fees were partly put on account cannot be refunded as a whole fee: waive the balance instead.
  const fee = isIn(FEE_TYPES, t.type) && !t.refundedAt && toCents(t.total) > 0 && toCents(t.balanceChange) === 0 ? { label: t.type === "RETURN" ? "FEES CHARGED AT RETURN" : "MEMBERSHIP FEE", cents: toCents(t.total) } : null;

  const originalTaxableBaseCents =
    t.items.filter((i) => i.taxable).reduce((n, i) => n + toCents(i.lineTotal), 0) +
    t.rentals.filter((r) => r.copy.rentalCategory?.taxable ?? true).reduce((n, r) => n + toCents(r.price), 0);
  const refundedTax = t.refunds.reduce((n, r) => n + Math.abs(toCents(r.tax)), 0);
  const originalTaxCents = toCents(t.tax);
  return {
    merchandise, rentals, fee, originalTaxCents, originalTaxableBaseCents,
    remainingTaxCents: Math.max(0, originalTaxCents - refundedTax),
    anything: merchandise.length > 0 || rentals.length > 0 || fee !== null,
  };
}

// ───────────────────────────── void ─────────────────────────────

export async function voidTransaction(tx: Tx, o: { storeId: string; userId: string; transactionId: string; reason: string }) {
  const t = await loadOriginal(tx, o.storeId, o.transactionId);
  if (!t) throw new TransactionOpError("TRANSACTION NOT FOUND.");
  const blocker = voidBlocker(t);
  if (blocker) throw new TransactionOpError(blocker);

  // Claim the void first: only one concurrent request can win.
  const claimed = await tx.transaction.updateMany({
    where: { id: t.id, storeId: o.storeId, voidedAt: null },
    data: { voidedAt: new Date(), voidedById: o.userId, voidReason: o.reason },
  });
  if (claimed.count !== 1) throw new TransactionOpError("THIS TRANSACTION WAS JUST VOIDED BY ANOTHER CLERK.");

  // Paid with store credit? The credit goes back to the customer.
  const creditUsed = -toCents(t.creditChange);
  if (creditUsed > 0) await addCredit(tx, { storeId: o.storeId, customerId: t.customerId, cents: creditUsed });

  const parts: string[] = [];
  // Rentals never happened: remove them and put the copies back on the shelf.
  if (t.rentals.length > 0) {
    // Re-check under the claim that nothing was returned in the meantime.
    const returned = await tx.rental.count({ where: { transactionId: t.id, storeId: o.storeId, returnedAt: { not: null } } });
    if (returned > 0) throw new TransactionOpError("A VIDEO FROM THIS RENTAL WAS JUST RETURNED. USE REFUND INSTEAD.");
    await tx.rental.deleteMany({ where: { transactionId: t.id, storeId: o.storeId } });
    await tx.inventoryCopy.updateMany({ where: { storeId: o.storeId, id: { in: t.rentals.map((r) => r.copyId) }, status: "RENTED" }, data: { status: "AVAILABLE" } });
    for (const r of t.rentals) parts.push(`${r.copy.movieTitle.title.toUpperCase()} ${r.copy.copyNumber}`);
  }
  // Merchandise goes back on the shelf.
  for (const i of t.items) {
    if (i.concessionItemId) await tx.concessionItem.updateMany({ where: { id: i.concessionItemId, storeId: o.storeId }, data: { quantityOnHand: { increment: i.quantity } } });
    parts.push(`${i.sku} ${i.description.toUpperCase()} x${i.quantity}`);
  }
  await tx.transaction.update({ where: { id: t.id, storeId: o.storeId }, data: { voidSnapshot: parts.join("; ").slice(0, 500) } });
  return { transactionId: t.id };
}

// ───────────────────────────── refund ─────────────────────────────

export type RefundRequest = {
  reason: string;
  paymentMethod: PaymentMethod;
  merchandise: { itemId: string; qty: number; restock: boolean }[]; // itemId = the original TransactionItem id
  rentalIds: string[];
  wholeFee: boolean;
};

export async function refundTransaction(tx: Tx, o: { storeId: string; userId: string; transactionId: string; request: RefundRequest }) {
  const t = await loadOriginal(tx, o.storeId, o.transactionId);
  if (!t) throw new TransactionOpError("TRANSACTION NOT FOUND.");
  if (t.voidedAt) throw new TransactionOpError("A VOIDED TRANSACTION CANNOT BE REFUNDED.");
  if (!isIn(REFUNDABLE, t.type)) throw new TransactionOpError("THIS KIND OF TRANSACTION CANNOT BE REFUNDED.");
  const can = refundability(t);
  const req = o.request;

  type NewItem = Prisma.TransactionItemCreateManyInput;
  const lines: RefundLine[] = [];
  const newItems: NewItem[] = [];
  const restock: { concessionItemId: string; qty: number }[] = [];

  // merchandise lines
  for (const m of req.merchandise) {
    const line = can.merchandise.find((x) => x.id === m.itemId);
    if (!line) throw new TransactionOpError("A MERCHANDISE LINE IS NOT REFUNDABLE (ALREADY FULLY REFUNDED, OR NOT PART OF THIS TRANSACTION).");
    if (m.qty < 1 || m.qty > line.remaining) throw new TransactionOpError(`${line.description.toUpperCase()}: YOU CAN REFUND 1 TO ${line.remaining} UNIT${line.remaining === 1 ? "" : "S"}.`);
    // Bump the refunded count atomically; the WHERE makes over-refunding impossible even with two clerks.
    const n = await tx.$executeRaw`UPDATE "TransactionItem" SET "refundedQty" = "refundedQty" + ${m.qty}::int WHERE "id" = ${line.id} AND "storeId" = ${o.storeId} AND "refundedQty" + ${m.qty}::int <= "quantity"`;
    if (n !== 1) throw new TransactionOpError(`${line.description.toUpperCase()} WAS JUST REFUNDED BY ANOTHER CLERK. RELOAD AND TRY AGAIN.`);
    const cents = line.unitCents * m.qty;
    lines.push({ cents, taxable: line.taxable });
    const original = t.items.find((i) => i.id === line.id)!;
    newItems.push({
      storeId: o.storeId, transactionId: "", concessionItemId: original.concessionItemId, sku: line.sku, description: line.description, kind: "MERCHANDISE",
      quantity: -m.qty, unitPrice: fromCents(line.unitCents), lineTotal: fromCents(-cents), taxable: line.taxable,
    });
    if (m.restock && original.concessionItemId) restock.push({ concessionItemId: original.concessionItemId, qty: m.qty });
  }

  // rental charges (money only: a video still out is returned separately, with no fee)
  for (const rentalId of req.rentalIds) {
    const r = can.rentals.find((x) => x.id === rentalId);
    if (!r) throw new TransactionOpError("A RENTAL CHARGE IS NOT REFUNDABLE (ALREADY REFUNDED, OR NOT PART OF THIS TRANSACTION).");
    const claimed = await tx.rental.updateMany({ where: { id: r.id, storeId: o.storeId, refundedAt: null }, data: { refundedAt: new Date() } });
    if (claimed.count !== 1) throw new TransactionOpError(`${r.label} WAS JUST REFUNDED BY ANOTHER CLERK. RELOAD AND TRY AGAIN.`);
    lines.push({ cents: r.cents, taxable: r.taxable });
    newItems.push({
      storeId: o.storeId, transactionId: "", concessionItemId: null, sku: "RENTAL", description: `RENTAL REFUND: ${r.label}`.slice(0, 120), kind: "RENTAL",
      quantity: -1, unitPrice: fromCents(r.cents), lineTotal: fromCents(-r.cents), taxable: r.taxable,
    });
  }

  // a whole fee payment (return fees or membership fee): all-or-nothing
  if (req.wholeFee) {
    if (!can.fee) throw new TransactionOpError("THERE IS NO REFUNDABLE FEE ON THIS TRANSACTION.");
    const claimed = await tx.transaction.updateMany({ where: { id: t.id, storeId: o.storeId, refundedAt: null, voidedAt: null }, data: { refundedAt: new Date() } });
    if (claimed.count !== 1) throw new TransactionOpError("THIS FEE WAS JUST REFUNDED BY ANOTHER CLERK.");
    lines.push({ cents: can.fee.cents, taxable: false });
    newItems.push({
      storeId: o.storeId, transactionId: "", concessionItemId: null, sku: t.type === "MEMBERSHIP_FEE" ? "MEMBERSHIP" : "FEE", description: `REFUND: ${can.fee.label}`,
      kind: "FEE", quantity: -1, unitPrice: fromCents(can.fee.cents), lineTotal: fromCents(-can.fee.cents), taxable: false,
    });
  }

  if (lines.length === 0) throw new TransactionOpError("SELECT AT LEAST ONE ITEM TO REFUND.");

  // Is this everything still refundable? Then return the exact remaining tax.
  const refundedAll =
    can.merchandise.every((m) => req.merchandise.some((x) => x.itemId === m.id && x.qty === m.remaining)) &&
    can.rentals.every((r) => req.rentalIds.includes(r.id)) &&
    (!can.fee || req.wholeFee);
  const totals = refundTotals(lines, {
    originalTaxCents: can.originalTaxCents, originalTaxableBaseCents: can.originalTaxableBaseCents,
    remainingTaxCents: can.remainingTaxCents, isFinalRefund: refundedAll,
  });

  // Refunding to STORE CREDIT puts the money on the customer's account instead of handing it back.
  const toCredit = req.paymentMethod === "STORE_CREDIT";
  if (toCredit) await addCredit(tx, { storeId: o.storeId, customerId: t.customerId, cents: totals.total });

  const { nextTransactionNumber } = await tx.store.update({ where: { id: o.storeId }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
  const refund = await tx.transaction.create({
    data: {
      storeId: o.storeId, number: nextTransactionNumber - 1, type: "REFUND", customerId: t.customerId, createdById: o.userId, refundOfId: t.id,
      subtotal: fromCents(-totals.subtotal), tax: fromCents(-totals.tax), total: fromCents(-totals.total), paymentMethod: req.paymentMethod,
      creditChange: toCredit ? fromCents(totals.total) : "0.00",
      notes: `REFUND OF #${String(t.number).padStart(6, "0")}: ${req.reason}`.slice(0, 200),
    },
  });
  await tx.transactionItem.createMany({ data: newItems.map((i) => ({ ...i, transactionId: refund.id })) });

  for (const r of restock) await tx.concessionItem.updateMany({ where: { id: r.concessionItemId, storeId: o.storeId }, data: { quantityOnHand: { increment: r.qty } } });
  return { refundId: refund.id, totalCents: totals.total, taxCents: totals.tax };
}

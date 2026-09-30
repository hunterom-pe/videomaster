import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { resolveBalanceAmount } from "@/lib/balance";
import { resolveTender } from "@/lib/cash";
import { fromCents, toCents } from "@/lib/pricing";

// Paying down or waiving a customer's account balance. Plain functions over a database transaction (no session);
// callers do authentication and role checks. Customer.outstandingFees is changed with a guarded update, so two
// clerks can never drive it negative, and every change is recorded as a signed Transaction.balanceChange.

type Tx = Prisma.TransactionClient;
export class BalanceOpError extends Error {}

type Base = { storeId: string; userId: string; customerId: string; amountRaw: string };

async function loadCustomer(tx: Tx, storeId: string, customerId: string) {
  const c = await tx.customer.findFirst({ where: { id: customerId, storeId } });
  if (!c) throw new BalanceOpError("CUSTOMER NOT FOUND.");
  return c;
}

async function nextNumber(tx: Tx, storeId: string) {
  const { nextTransactionNumber } = await tx.store.update({ where: { id: storeId }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
  return nextTransactionNumber - 1;
}

async function reduceBalance(tx: Tx, storeId: string, customerId: string, cents: number) {
  const done = await tx.customer.updateMany({
    where: { id: customerId, storeId, outstandingFees: { gte: fromCents(cents) } },
    data: { outstandingFees: { decrement: fromCents(cents) } },
  });
  if (done.count !== 1) throw new BalanceOpError("THE BALANCE CHANGED. RELOAD THE ACCOUNT AND TRY AGAIN.");
}

/** Customer pays some or all of their balance. */
export async function payBalance(tx: Tx, o: Base & { method: PaymentMethod; tenderedRaw?: string }) {
  const c = await loadCustomer(tx, o.storeId, o.customerId);
  const amount = resolveBalanceAmount(toCents(c.outstandingFees), o.amountRaw);
  if (!amount.ok) throw new BalanceOpError(amount.message);
  const tender = resolveTender(o.method, amount.cents, o.tenderedRaw);
  if (!tender.ok) throw new BalanceOpError(tender.message);
  await reduceBalance(tx, o.storeId, c.id, amount.cents);
  const t = await tx.transaction.create({
    data: {
      storeId: o.storeId, number: await nextNumber(tx, o.storeId), type: "ACCOUNT_PAYMENT", customerId: c.id, createdById: o.userId,
      subtotal: fromCents(amount.cents), tax: "0.00", total: fromCents(amount.cents), paymentMethod: o.method,
      tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents),
      balanceChange: fromCents(-amount.cents), notes: "PAYMENT ON ACCOUNT",
    },
  });
  return { transactionId: t.id, cents: amount.cents };
}

/** Manager forgives some or all of a balance. No money changes hands. */
export async function waiveBalance(tx: Tx, o: Base & { reason: string }) {
  const c = await loadCustomer(tx, o.storeId, o.customerId);
  const amount = resolveBalanceAmount(toCents(c.outstandingFees), o.amountRaw);
  if (!amount.ok) throw new BalanceOpError(amount.message);
  await reduceBalance(tx, o.storeId, c.id, amount.cents);
  const t = await tx.transaction.create({
    data: {
      storeId: o.storeId, number: await nextNumber(tx, o.storeId), type: "FEE_WAIVER", customerId: c.id, createdById: o.userId,
      subtotal: "0.00", tax: "0.00", total: "0.00", paymentMethod: "OTHER",
      balanceChange: fromCents(-amount.cents), notes: `BALANCE WAIVED: ${o.reason}`.slice(0, 200),
    },
  });
  return { transactionId: t.id, cents: amount.cents };
}

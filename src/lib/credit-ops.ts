import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { parseTender, resolveTender } from "@/lib/cash";
import { fromCents } from "@/lib/pricing";

// Store credit: money a customer has on account with the store. Plain functions over a database transaction (no
// session). Customer.storeCredit changes only through guarded updates, and every change is recorded as a signed
// Transaction.creditChange, so the balance can always be audited. Credit SOLD is a liability (not revenue); revenue is
// recognised when the credit is spent.

type Tx = Prisma.TransactionClient;
export class CreditError extends Error {}
export const MAX_CREDIT_SALE_CENTS = 50_000; // $500.00 per sale

/** Take `cents` of credit from a customer for a payment. Throws if there is no customer or not enough credit. */
export async function spendCredit(tx: Tx, o: { storeId: string; customerId: string | null; cents: number }) {
  if (o.cents <= 0) return;
  if (!o.customerId) throw new CreditError("STORE CREDIT CAN ONLY BE USED ON A CUSTOMER'S ACCOUNT, NOT A WALK-IN SALE.");
  const done = await tx.customer.updateMany({
    where: { id: o.customerId, storeId: o.storeId, storeCredit: { gte: fromCents(o.cents) } },
    data: { storeCredit: { decrement: fromCents(o.cents) } },
  });
  if (done.count !== 1) throw new CreditError("THE CUSTOMER DOES NOT HAVE ENOUGH STORE CREDIT FOR THIS PAYMENT.");
}

/** Put `cents` of credit on a customer's account (refund to credit, or a credit sale). */
export async function addCredit(tx: Tx, o: { storeId: string; customerId: string | null; cents: number }) {
  if (o.cents <= 0) return;
  if (!o.customerId) throw new CreditError("STORE CREDIT REQUIRES A CUSTOMER. A WALK-IN SALE CANNOT BE REFUNDED TO STORE CREDIT.");
  const done = await tx.customer.updateMany({ where: { id: o.customerId, storeId: o.storeId }, data: { storeCredit: { increment: fromCents(o.cents) } } });
  if (done.count !== 1) throw new CreditError("CUSTOMER NOT FOUND.");
}

/** The signed `creditChange` value to record on a transaction paid (partly) with store credit. */
export const creditUsedChange = (method: string, paidCents: number) => (method === "STORE_CREDIT" && paidCents > 0 ? fromCents(-paidCents) : "0.00");

/** Customer buys store credit (like a gift card for themselves). Cash/card/etc.; not paid with store credit. */
export async function sellCredit(tx: Tx, o: { storeId: string; userId: string; customerId: string; amountRaw: string; method: PaymentMethod; tenderedRaw?: string }) {
  if (o.method === "STORE_CREDIT") throw new CreditError("STORE CREDIT CANNOT BE BOUGHT WITH STORE CREDIT.");
  const customer = await tx.customer.findFirst({ where: { id: o.customerId, storeId: o.storeId } });
  if (!customer) throw new CreditError("CUSTOMER NOT FOUND.");
  const cents = parseTender(o.amountRaw);
  if (cents === null || Number.isNaN(cents) || cents <= 0) throw new CreditError("ENTER THE AMOUNT OF CREDIT, SUCH AS 20 OR 20.00.");
  if (cents > MAX_CREDIT_SALE_CENTS) throw new CreditError(`A CREDIT SALE CANNOT EXCEED $${(MAX_CREDIT_SALE_CENTS / 100).toFixed(2)}.`);
  const tender = resolveTender(o.method, cents, o.tenderedRaw);
  if (!tender.ok) throw new CreditError(tender.message);
  await addCredit(tx, { storeId: o.storeId, customerId: customer.id, cents });
  const { nextTransactionNumber } = await tx.store.update({ where: { id: o.storeId }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
  const t = await tx.transaction.create({
    data: {
      storeId: o.storeId, number: nextTransactionNumber - 1, type: "STORE_CREDIT_SALE", customerId: customer.id, createdById: o.userId,
      subtotal: fromCents(cents), tax: "0.00", total: fromCents(cents), paymentMethod: o.method,
      tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents), creditChange: fromCents(cents), notes: "STORE CREDIT PURCHASED",
    },
  });
  return { transactionId: t.id, cents };
}

import "server-only";
import type { PaymentMethod, Prisma, TransactionType } from "@/generated/prisma/client";
import { parseDay } from "@/lib/dates";
import { db } from "@/lib/db";

export const PAGE_SIZE = 25;
export const TYPE_LABELS: Record<TransactionType, string> = {
  RENTAL: "RENTAL", RETURN: "RETURN", RETAIL_SALE: "RETAIL SALE", LATE_FEE: "LATE FEE",
  REFUND: "REFUND", FEE_WAIVER: "FEE WAIVER", DAMAGE_FEE: "DAMAGE FEE", LOST_ITEM_FEE: "LOST ITEM FEE",
};
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "CASH", CREDIT_CARD: "CREDIT CARD", DEBIT: "DEBIT", CHECK: "CHECK", STORE_CREDIT: "STORE CREDIT", OTHER: "OTHER",
};

export type TxFilters = { q: string; type: string; payment: string; from: string; to: string };

export function transactionWhere(storeId: string, f: TxFilters): Prisma.TransactionWhereInput {
  const from = parseDay(f.from);
  const to = parseDay(f.to);
  const terms = f.q.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    storeId,
    ...(f.type in TYPE_LABELS ? { type: f.type as TransactionType } : {}),
    ...(f.payment in PAYMENT_LABELS ? { paymentMethod: f.payment as PaymentMethod } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}) } } : {}),
    AND: terms.map((t) => ({
      OR: [
        ...(/^\d{1,9}$/.test(t) ? [{ number: Number(t) }] : []),
        ...(t.length >= 3 && "walk-in".startsWith(t.toLowerCase()) ? [{ customerId: null }] : []),
        { customer: { firstName: { contains: t, mode: "insensitive" as const } } },
        { customer: { lastName: { contains: t, mode: "insensitive" as const } } },
        { customer: { membershipNumber: { contains: t, mode: "insensitive" as const } } },
      ],
    })),
  };
}

export async function searchTransactions(storeId: string, f: TxFilters, page: number) {
  const where = transactionWhere(storeId, f);
  const [rows, total, agg] = await Promise.all([
    db.transaction.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { customer: { select: { firstName: true, lastName: true } }, _count: { select: { rentals: true, items: true, returnedRentals: true } } },
    }),
    db.transaction.count({ where }),
    db.transaction.aggregate({ where, _sum: { total: true } }),
  ]);
  return { rows, total, sum: agg._sum.total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

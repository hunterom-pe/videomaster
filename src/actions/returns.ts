"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resolveTender } from "@/lib/cash";
import { daysLate, lateFeeCents } from "@/lib/late-fees";
import { fmtMoney, fromCents, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { returnSchema, zodErrors, type ActionState, type ReturnValues } from "@/lib/validation";

class ReturnError extends Error {}

const rentalInclude = {
  customer: { select: { firstName: true, lastName: true, membershipNumber: true, phone: true } },
  copy: { include: { movieTitle: { select: { title: true, year: true } }, rentalCategory: true } },
} satisfies Prisma.RentalInclude;

export type ActiveRental = Prisma.RentalGetPayload<{ include: typeof rentalInclude }>;

/** Active (unreturned) rentals in this store, optionally filtered by copy ID, barcode, title or customer. */
export async function listActiveRentals(q: string, page: number, pageSize: number) {
  const { store } = await requireStore();
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const where: Prisma.RentalWhereInput = {
    storeId: store.id,
    returnedAt: null,
    AND: terms.map((t) => {
      const digits = t.replace(/\D/g, "");
      return {
        OR: [
          { copy: { copyNumber: { contains: t, mode: "insensitive" as const } } },
          { copy: { barcode: t } },
          { copy: { movieTitle: { title: { contains: t, mode: "insensitive" as const } } } },
          { customer: { firstName: { contains: t, mode: "insensitive" as const } } },
          { customer: { lastName: { contains: t, mode: "insensitive" as const } } },
          { customer: { membershipNumber: { contains: t, mode: "insensitive" as const } } },
          ...(digits.length >= 3 ? [{ customer: { phoneDigits: { contains: digits } } }] : []),
        ],
      };
    }),
  };
  const [rows, total] = await Promise.all([
    db.rental.findMany({ where, orderBy: { dueAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: rentalInclude }),
    db.rental.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Completes a return: closes the rental, sets the copy's status, records fees and a RETURN transaction. */
export async function completeReturn(rentalId: string, input: ReturnValues): Promise<ActionState> {
  const { store, user } = await requireStore();
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  const d = parsed.data;

  let transactionId: string;
  try {
    transactionId = await db.$transaction(async (tx) => {
      // Ownership is part of the query: the rental must belong to this store and still be out.
      const rental = await tx.rental.findFirst({ where: { id: rentalId, storeId: store.id, returnedAt: null }, include: rentalInclude });
      if (!rental) throw new ReturnError("THIS RENTAL WAS NOT FOUND OR HAS ALREADY BEEN RETURNED.");

      const now = new Date();
      const cat = rental.copy.rentalCategory;
      const calculated = cat
        ? lateFeeCents(daysLate(rental.dueAt, now, store.settings!.timezone), toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null)
        : 0;

      // Late fee: may be reduced or waived, never raised above the policy amount. Lost items owe no late fee.
      let lateCharged = d.outcome === "LOST" ? 0 : toCents(d.lateFee);
      if (lateCharged > calculated) throw new ReturnError(`LATE FEE CANNOT EXCEED THE CALCULATED AMOUNT (${fmtMoney(calculated)}).`);
      const other = d.outcome === "RETURNED" ? 0 : toCents(d.otherFee);
      if (d.outcome === "LOST") lateCharged = 0;
      // Rewind fee: amount comes from store settings (never from the browser); VHS only; not for lost items.
      const rewind = d.notRewound && d.outcome !== "LOST" && rental.copy.format === "VHS" ? toCents(store.settings!.rewindFee) : 0;
      const total = lateCharged + other + rewind;
      const tender = resolveTender(d.paymentMethod, total, input.tendered);
      if (!tender.ok) throw new ReturnError(tender.message);

      const { nextTransactionNumber } = await tx.store.update({
        where: { id: store.id },
        data: { nextTransactionNumber: { increment: 1 } },
        select: { nextTransactionNumber: true },
      });
      const notes = [
        d.outcome !== "RETURNED" ? `COPY MARKED ${d.outcome}` : null,
        calculated !== lateCharged && d.outcome !== "LOST" ? `LATE FEE ${fmtMoney(calculated)} CALCULATED, ${fmtMoney(lateCharged)} CHARGED${lateCharged === 0 ? " (WAIVED)" : " (REDUCED)"}` : null,
        d.outcome === "LOST" && calculated > 0 ? `LATE FEE ${fmtMoney(calculated)} NOT CHARGED (LOST ITEM)` : null,
        rewind > 0 ? `REWIND FEE ${fmtMoney(rewind)}` : null,
      ].filter(Boolean).join("; ");
      const transaction = await tx.transaction.create({
        data: {
          storeId: store.id, number: nextTransactionNumber - 1, type: "RETURN", customerId: rental.customerId, createdById: user.id,
          subtotal: fromCents(total), tax: "0.00", total: fromCents(total), paymentMethod: d.paymentMethod as PaymentMethod, notes: notes || null,
          tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents),
        },
      });

      // Guarded close: only one concurrent return can win.
      const closed = await tx.rental.updateMany({
        where: { id: rental.id, storeId: store.id, returnedAt: null },
        data: {
          returnedAt: now, outcome: d.outcome, calculatedLateFee: fromCents(calculated), chargedLateFee: fromCents(lateCharged),
          otherFee: other > 0 ? fromCents(other) : null, rewindFee: rewind > 0 ? fromCents(rewind) : null, returnTransactionId: transaction.id,
        },
      });
      if (closed.count !== 1) throw new ReturnError("THIS RENTAL WAS JUST RETURNED BY ANOTHER CLERK.");

      await tx.inventoryCopy.updateMany({
        where: { id: rental.copyId, storeId: store.id },
        data: { status: d.outcome === "DAMAGED" ? "DAMAGED" : d.outcome === "LOST" ? "LOST" : "AVAILABLE" },
      });
      return transaction.id;
    });
  } catch (e) {
    if (e instanceof ReturnError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidatePath("/inventory");
  revalidatePath("/customers");
  revalidatePath("/return");
  redirect(`/receipt/${transactionId}?new=1`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { dueDate, fromCents, taxCents, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { checkoutSchema, zodErrors, type ActionState, type CheckoutValues } from "@/lib/validation";

export type CartItem = {
  copyId: string;
  copyNumber: string;
  title: string;
  year: number | null;
  format: string;
  categoryName: string;
  priceCents: number;
  days: number;
  taxable: boolean;
};

export type TitleHit = {
  titleId: string;
  title: string;
  year: number | null;
  groups: { format: string; available: number; copies: CartItem[] }[];
};

const MAX_HITS = 8;
const MAX_COPIES_PER_GROUP = 6;

const toItem = (c: {
  id: string; copyNumber: string; format: keyof typeof FORMAT_LABELS;
  movieTitle: { title: string; year: number | null };
  rentalCategory: { name: string; rentalPrice: { toString(): string }; rentalDays: number; taxable: boolean } | null;
}): CartItem | null =>
  c.rentalCategory
    ? {
        copyId: c.id, copyNumber: c.copyNumber, title: c.movieTitle.title, year: c.movieTitle.year,
        format: FORMAT_LABELS[c.format], categoryName: c.rentalCategory.name,
        priceCents: toCents(c.rentalCategory.rentalPrice), days: c.rentalCategory.rentalDays, taxable: c.rentalCategory.taxable,
      }
    : null;

const copyInclude = {
  movieTitle: { select: { title: true, year: true } },
  rentalCategory: { select: { name: true, rentalPrice: true, rentalDays: true, taxable: true } },
} as const;

/** Available copies matching a title search, exact copy ID, or barcode. Scoped to the session's store. */
export async function findRentableCopies(query: string, excludeIds: string[]): Promise<{ hits: TitleHit[]; message?: string }> {
  const { store } = await requireStore();
  const q = query.trim().slice(0, 100);
  if (!q) return { hits: [] };
  const exclude = excludeIds.slice(0, 50);

  // 1) Copy ID or barcode entered directly (e.g. from a scanner).
  const direct = await db.inventoryCopy.findFirst({
    where: { storeId: store.id, OR: [{ copyNumber: { equals: q, mode: "insensitive" } }, { barcode: q }] },
    include: copyInclude,
  });
  if (direct) {
    if (exclude.includes(direct.id)) return { hits: [], message: `COPY ${direct.copyNumber} IS ALREADY IN THIS TRANSACTION` };
    if (direct.status !== "AVAILABLE") return { hits: [], message: `COPY ${direct.copyNumber} IS NOT AVAILABLE (STATUS: ${direct.status})` };
    const item = toItem(direct);
    if (!item) return { hits: [], message: `COPY ${direct.copyNumber} HAS NO RENTAL CATEGORY. ASSIGN ONE FIRST.` };
    return { hits: [{ titleId: direct.movieTitleId, title: item.title, year: item.year, groups: [{ format: item.format, available: 1, copies: [item] }] }] };
  }

  // 2) Title search.
  const titles = await db.movieTitle.findMany({
    where: { storeId: store.id, title: { contains: q, mode: "insensitive" } },
    orderBy: [{ title: "asc" }, { year: "asc" }],
    take: MAX_HITS,
  });
  const hits: TitleHit[] = [];
  for (const t of titles) {
    const copies = await db.inventoryCopy.findMany({
      where: { storeId: store.id, movieTitleId: t.id, status: "AVAILABLE", id: { notIn: exclude } },
      orderBy: { copyNumber: "asc" },
      include: copyInclude,
    });
    const byFormat = new Map<string, CartItem[]>();
    for (const c of copies) {
      const item = toItem(c);
      if (item) byFormat.set(item.format, [...(byFormat.get(item.format) ?? []), item]);
    }
    hits.push({
      titleId: t.id, title: t.title, year: t.year,
      groups: [...byFormat.entries()].map(([format, items]) => ({ format, available: items.length, copies: items.slice(0, MAX_COPIES_PER_GROUP) })),
    });
  }
  return { hits, message: hits.length === 0 ? `NO TITLE MATCHES "${q.toUpperCase()}"` : undefined };
}

class CheckoutError extends Error {}

/** Completes a rental transaction. Everything is re-verified server-side; the client cart is only a list of copy IDs. */
export async function checkout(customerId: string, input: CheckoutValues): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FOLLOWING" };
  const { copyIds, paymentMethod, override } = parsed.data;

  const customer = await db.customer.findFirst({ where: { id: customerId, storeId: store.id } });
  if (!customer) return { ok: false, errors: {}, message: "CUSTOMER NOT FOUND" };
  if (customer.status === "CLOSED") return { ok: false, errors: {}, message: "*** CUSTOMER ACCOUNT CLOSED *** NO RENTALS ARE ALLOWED ON A CLOSED ACCOUNT." };
  if (customer.status !== "GOOD") {
    if (role === "EMPLOYEE") return { ok: false, errors: {}, message: `*** ACCOUNT ${customer.status} *** MANAGER OVERRIDE REQUIRED.` };
    if (!override) return { ok: false, errors: {}, message: `*** ACCOUNT ${customer.status} *** CHECK "MANAGER OVERRIDE" TO CONTINUE.` };
  }

  const taxPercent = store.settings!.salesTaxPercent;
  let transactionId: string;
  try {
    transactionId = await db.$transaction(async (tx) => {
      const copies = await tx.inventoryCopy.findMany({ where: { id: { in: copyIds }, storeId: store.id }, include: { rentalCategory: true } });
      if (copies.length !== copyIds.length) throw new CheckoutError("ONE OR MORE COPIES WERE NOT FOUND IN THIS STORE.");
      const missing = copies.find((c) => !c.rentalCategory);
      if (missing) throw new CheckoutError(`COPY ${missing.copyNumber} HAS NO RENTAL CATEGORY.`);

      const unavailable = copies.filter((c) => c.status !== "AVAILABLE").map((c) => c.copyNumber);
      if (unavailable.length) throw new CheckoutError(`*** NO AVAILABLE COPIES *** ${unavailable.join(", ")} IS NOT AVAILABLE. REMOVE IT AND TRY AGAIN.`);

      // Atomic claim: only flips copies that are still AVAILABLE, so two clerks can never rent the same tape.
      const claimed = await tx.inventoryCopy.updateMany({
        where: { id: { in: copyIds }, storeId: store.id, status: "AVAILABLE" },
        data: { status: "RENTED" },
      });
      if (claimed.count !== copyIds.length)
        throw new CheckoutError("*** NO AVAILABLE COPIES *** A COPY WAS JUST RENTED BY ANOTHER CLERK. RELOAD AND TRY AGAIN.");

      const now = new Date();
      const priced = copies.map((c) => ({ copy: c, cat: c.rentalCategory!, cents: toCents(c.rentalCategory!.rentalPrice) }));
      const subtotal = priced.reduce((n, p) => n + p.cents, 0);
      const tax = taxCents(priced.filter((p) => p.cat.taxable).reduce((n, p) => n + p.cents, 0), taxPercent.toString());

      const { nextTransactionNumber } = await tx.store.update({
        where: { id: store.id },
        data: { nextTransactionNumber: { increment: 1 } },
        select: { nextTransactionNumber: true },
      });
      const transaction = await tx.transaction.create({
        data: {
          storeId: store.id, number: nextTransactionNumber - 1, type: "RENTAL", customerId: customer.id, createdById: user.id,
          subtotal: fromCents(subtotal), tax: fromCents(tax), total: fromCents(subtotal + tax), paymentMethod: paymentMethod as PaymentMethod,
        },
      });
      await tx.rental.createMany({
        data: priced.map((p) => ({
          storeId: store.id, customerId: customer.id, copyId: p.copy.id, transactionId: transaction.id,
          price: fromCents(p.cents), rentedAt: now, dueAt: dueDate(now, p.cat.rentalDays),
        })),
      });
      return transaction.id;
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidatePath("/inventory");
  revalidatePath("/customers");
  redirect(`/rent/done/${transactionId}`);
}

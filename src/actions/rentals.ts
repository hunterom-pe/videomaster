"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { resolveTender } from "@/lib/cash";
import { computeTotals, dueDate, fromCents, toCents } from "@/lib/pricing";
import { membershipState } from "@/lib/membership";
import { effectiveStatus, overdueCounts } from "@/lib/overdue";
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

export type SaleItem = {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  taxable: boolean;
  onHand: number;
};

/** Sellable merchandise (active, in stock). Scoped to the session's store. Empty query lists by category or all. */
export async function findSaleItems(query: string, category: string): Promise<{ items: SaleItem[]; message?: string }> {
  const { store } = await requireStore();
  const q = query.trim().slice(0, 100);
  // A category filter only counts if it belongs to this store.
  const cat = category ? store.concessionCategories.find((c) => c.id === category) : undefined;
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const rows = await db.concessionItem.findMany({
    where: {
      storeId: store.id,
      active: true,
      quantityOnHand: { gt: 0 },
      ...(cat ? { categoryId: cat.id } : {}),
      AND: terms.map((t) => ({ OR: [{ name: { contains: t, mode: "insensitive" as const } }, { sku: { contains: t, mode: "insensitive" as const } }, { barcode: t }] })),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    take: 30,
    include: { category: { select: { name: true } } },
  });
  const items = rows.map((r) => ({
    itemId: r.id, sku: r.sku, name: r.name, category: r.category.name,
    priceCents: toCents(r.retailPrice), taxable: r.taxable, onHand: r.quantityOnHand,
  }));
  return { items, message: items.length === 0 ? "NO IN-STOCK MERCHANDISE MATCHES. CHECK THE CONCESSIONS SCREEN FOR STOCK LEVELS." : undefined };
}

class CheckoutError extends Error {}

/**
 * Completes a transaction with rentals and/or merchandise. Everything is re-verified server-side; the client cart is
 * only copy IDs and (itemId, quantity) pairs. `customerId` may be null for a walk-in merchandise-only sale.
 */
export async function checkout(customerId: string | null, input: CheckoutValues): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FOLLOWING" };
  const { copyIds, items, paymentMethod, override } = parsed.data;

  if (copyIds.length > 0 && !customerId) return { ok: false, errors: {}, message: "SELECT A CUSTOMER BEFORE RENTING VIDEOS." };

  let customer = null;
  if (customerId) {
    customer = await db.customer.findFirst({ where: { id: customerId, storeId: store.id } });
    if (!customer) return { ok: false, errors: {}, message: "CUSTOMER NOT FOUND" };
    // Account restrictions apply to rentals; a merchandise-only purchase is always allowed.
    if (copyIds.length > 0) {
      const acct = effectiveStatus(customer.status, (await overdueCounts(store.id, [customer.id], store.settings!.timezone)).get(customer.id) ?? 0);
      if (acct === "CLOSED") return { ok: false, errors: {}, message: "*** CUSTOMER ACCOUNT CLOSED *** NO RENTALS ARE ALLOWED ON A CLOSED ACCOUNT." };
      // Anything that needs a manager override, gathered so the clerk sees every reason at once.
      const reasons: string[] = [];
      if (acct !== "GOOD") reasons.push(`ACCOUNT ${acct}`);
      if (membershipState(customer.membershipExpiresAt, new Date()) === "EXPIRED") reasons.push("MEMBERSHIP EXPIRED");
      const max = store.settings!.maxRentalsOut;
      if (max > 0) {
        const out = await db.rental.count({ where: { storeId: store.id, customerId: customer.id, returnedAt: null } });
        if (out + copyIds.length > max) reasons.push(`RENTAL LIMIT ${max} (${out} ALREADY OUT)`);
      }
      if (reasons.length > 0) {
        const why = `*** ${reasons.join("; ")} ***`;
        if (role === "EMPLOYEE") return { ok: false, errors: {}, message: `${why} MANAGER OVERRIDE REQUIRED.` };
        if (!override) return { ok: false, errors: {}, message: `${why} CHECK "MANAGER OVERRIDE" TO CONTINUE.` };
      }
    }
  }

  const taxPercent = store.settings!.salesTaxPercent;
  let transactionId: string;
  try {
    transactionId = await db.$transaction(async (tx) => {
      const now = new Date();

      // ── Rentals: verify copies, claim atomically ──
      const copies = copyIds.length ? await tx.inventoryCopy.findMany({ where: { id: { in: copyIds }, storeId: store.id }, include: { rentalCategory: true } }) : [];
      if (copies.length !== copyIds.length) throw new CheckoutError("ONE OR MORE COPIES WERE NOT FOUND IN THIS STORE.");
      const missing = copies.find((c) => !c.rentalCategory);
      if (missing) throw new CheckoutError(`COPY ${missing.copyNumber} HAS NO RENTAL CATEGORY.`);
      const unavailable = copies.filter((c) => c.status !== "AVAILABLE").map((c) => c.copyNumber);
      if (unavailable.length) throw new CheckoutError(`*** NO AVAILABLE COPIES *** ${unavailable.join(", ")} IS NOT AVAILABLE. REMOVE IT AND TRY AGAIN.`);
      if (copyIds.length) {
        // Only flips copies that are still AVAILABLE, so two clerks can never rent the same tape.
        const claimed = await tx.inventoryCopy.updateMany({ where: { id: { in: copyIds }, storeId: store.id, status: "AVAILABLE" }, data: { status: "RENTED" } });
        if (claimed.count !== copyIds.length) throw new CheckoutError("*** NO AVAILABLE COPIES *** A COPY WAS JUST RENTED BY ANOTHER CLERK. RELOAD AND TRY AGAIN.");
      }

      // ── Merchandise: verify, then decrement stock atomically (never below zero) ──
      const catalog = items.length ? await tx.concessionItem.findMany({ where: { id: { in: items.map((i) => i.itemId) }, storeId: store.id } }) : [];
      if (catalog.length !== items.length) throw new CheckoutError("ONE OR MORE MERCHANDISE ITEMS WERE NOT FOUND IN THIS STORE.");
      const lines = items.map((i) => ({ line: i, item: catalog.find((c) => c.id === i.itemId)! }));
      const inactive = lines.find((l) => !l.item.active);
      if (inactive) throw new CheckoutError(`${inactive.item.name.toUpperCase()} IS INACTIVE AND CANNOT BE SOLD.`);
      for (const { line, item } of lines) {
        const r = await tx.concessionItem.updateMany({
          where: { id: item.id, storeId: store.id, active: true, quantityOnHand: { gte: line.quantity } },
          data: { quantityOnHand: { decrement: line.quantity } },
        });
        if (r.count !== 1) {
          const fresh = await tx.concessionItem.findFirst({ where: { id: item.id, storeId: store.id }, select: { quantityOnHand: true } });
          throw new CheckoutError(`*** NOT ENOUGH STOCK *** ${item.name.toUpperCase()}: ${line.quantity} REQUESTED, ${fresh?.quantityOnHand ?? 0} ON HAND.`);
        }
      }

      // ── Pricing: from the database, never from the browser ──
      const rentalLines = copies.map((c) => ({ copy: c, cat: c.rentalCategory!, cents: toCents(c.rentalCategory!.rentalPrice) }));
      const merchLines = lines.map(({ line, item }) => ({ item, qty: line.quantity, unit: toCents(item.retailPrice), cents: toCents(item.retailPrice) * line.quantity }));
      const totals = computeTotals(
        rentalLines.map((r) => ({ cents: r.cents, taxable: r.cat.taxable })),
        merchLines.map((m) => ({ cents: m.cents, taxable: m.item.taxable })),
        taxPercent.toString(),
      );

      const tender = resolveTender(paymentMethod, totals.total, input.tendered);
      if (!tender.ok) throw new CheckoutError(tender.message);

      const { nextTransactionNumber } = await tx.store.update({ where: { id: store.id }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
      const transaction = await tx.transaction.create({
        data: {
          storeId: store.id, number: nextTransactionNumber - 1, type: copies.length ? "RENTAL" : "RETAIL_SALE", customerId: customer?.id ?? null, createdById: user.id,
          subtotal: fromCents(totals.subtotal), tax: fromCents(totals.tax), total: fromCents(totals.total), paymentMethod: paymentMethod as PaymentMethod,
          tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents),
        },
      });
      if (rentalLines.length)
        await tx.rental.createMany({
          data: rentalLines.map((p) => ({
            storeId: store.id, customerId: customer!.id, copyId: p.copy.id, transactionId: transaction.id,
            price: fromCents(p.cents), rentedAt: now, dueAt: dueDate(now, p.cat.rentalDays),
          })),
        });
      if (merchLines.length)
        await tx.transactionItem.createMany({
          data: merchLines.map((m) => ({
            storeId: store.id, transactionId: transaction.id, concessionItemId: m.item.id, sku: m.item.sku, description: m.item.name,
            quantity: m.qty, unitPrice: fromCents(m.unit), lineTotal: fromCents(m.cents), taxable: m.item.taxable,
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
  revalidatePath("/concessions");
  revalidatePath("/menu");
  redirect(`/receipt/${transactionId}?new=1`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type ConcessionCategory } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fromCents, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { CONCESSION_CATEGORIES, addStockSchema, concessionSchema, zodErrors, type ActionState, type ConcessionFormValues } from "@/lib/validation";

const fail = (errors: Record<string, string>, message = "PLEASE CORRECT THE FIELDS MARKED BELOW"): ActionState => ({ ok: false, errors, message });
const money = (n: number) => fromCents(toCents(n));

function fields(d: ReturnType<typeof concessionSchema.parse>) {
  return {
    name: d.name,
    category: d.category as ConcessionCategory,
    retailPrice: money(d.retailPrice),
    costPrice: d.costPrice === null ? null : money(d.costPrice),
    quantityOnHand: d.quantityOnHand,
    lowStockThreshold: d.lowStockThreshold,
    taxable: d.taxable,
    active: d.active,
    barcode: d.barcode || null,
  };
}

function uniqueError(e: unknown): ActionState | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
    return target.includes("barcode") ? fail({ barcode: "THAT BARCODE IS ALREADY ASSIGNED TO ANOTHER ITEM" }) : fail({ sku: "THAT SKU IS ALREADY IN USE" });
  }
  return null;
}

export async function createConcession(input: ConcessionFormValues): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = concessionSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const d = parsed.data;

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      let sku = d.sku;
      if (!sku) {
        // Auto SKU: category letter + next free 3-digit number for that letter (C001, C002, P001...).
        const prefix = CONCESSION_CATEGORIES.find((c) => c.value === d.category)!.prefix;
        const existing = await tx.concessionItem.findMany({ where: { storeId: store.id, sku: { startsWith: prefix } }, select: { sku: true } });
        const used = existing.map((e) => e.sku.match(new RegExp(`^${prefix}(\\d+)$`))?.[1]).filter(Boolean).map(Number);
        sku = `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
      }
      return (await tx.concessionItem.create({ data: { storeId: store.id, sku, ...fields(d) } })).id;
    });
  } catch (e) {
    const u = uniqueError(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/concessions");
  redirect(`/concessions?saved=${id}`);
}

export async function updateConcession(itemId: string, input: ConcessionFormValues): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = concessionSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const d = parsed.data;

  try {
    // SKU is fixed once created (it may appear on receipts); everything else is editable.
    const r = await db.concessionItem.updateMany({ where: { id: itemId, storeId: store.id }, data: fields(d) });
    if (r.count === 0) return fail({}, "ITEM NOT FOUND");
  } catch (e) {
    const u = uniqueError(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/concessions");
  redirect(`/concessions?saved=${itemId}`);
}

/** Receive stock: atomic increment (no read-modify-write race). */
export async function addStock(itemId: string, amount: string): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = addStockSchema.safeParse({ amount });
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const r = await db.concessionItem.updateMany({
    where: { id: itemId, storeId: store.id },
    data: { quantityOnHand: { increment: parsed.data.amount } },
  });
  if (r.count === 0) return fail({}, "ITEM NOT FOUND");
  revalidatePath("/concessions");
  redirect(`/concessions?saved=${itemId}`);
}

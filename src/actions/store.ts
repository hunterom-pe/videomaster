"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { loadSampleData } from "@/lib/sample-store";
import { getUserStore, requireStore, requireUser } from "@/lib/store-access";
import { storeSchema, zodErrors, type ActionState, type StoreFormValues } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";
import { categoryFields, concessionCategoryFields, formatRows, settingsFields, storeFields, type Parsed } from "@/lib/store-fields";

function validate(input: StoreFormValues): { data: Parsed } | { state: ActionState } {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success)
    return { state: { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" } };
  return { data: parsed.data };
}

/** First-run setup: creates the user's store, settings, formats and categories. */
export async function createStore(input: StoreFormValues, loadSample = false): Promise<ActionState> {
  const user = await requireUser();
  if (await getUserStore(user.id)) redirect("/menu"); // one store per user in v1.0

  const v = validate(input);
  if ("state" in v) return v.state;
  const d = v.data;

  await db.$transaction(
    async (tx) => {
      // Re-check inside the transaction so a double-submit cannot create two stores.
      if (await tx.storeMember.findFirst({ where: { userId: user.id } })) return;
      const created = await tx.store.create({
        data: {
          ...storeFields(d),
          members: { create: { userId: user.id, role: "OWNER" } },
          settings: { create: settingsFields(d) },
          formats: { create: formatRows(d) },
          rentalCategories: { create: d.categories.map((c, i) => categoryFields(c, i)) },
          concessionCategories: { create: d.concessionCategories.map((c, i) => concessionCategoryFields(c, i)) },
        },
      });
      if (loadSample === true) await loadSampleData(tx, created.id, user.id);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  redirect("/menu");
}

/** Store settings edit. The store is resolved from the session, never from the request. */
export async function updateStore(input: StoreFormValues): Promise<ActionState> {
  const { store, role } = await requireStore();
  if (role === "EMPLOYEE") return { ok: false, errors: {}, message: "MANAGER OVERRIDE REQUIRED TO CHANGE STORE SETTINGS" };

  const v = validate(input);
  if ("state" in v) return v.state;
  const d = v.data;

  const owned = new Set(store.rentalCategories.map((c) => c.id));
  const keepIds = d.categories.flatMap((c) => (c.id ? [c.id] : []));
  if (keepIds.some((id) => !owned.has(id)))
    return { ok: false, errors: {}, message: "INVALID CATEGORY REFERENCE. RELOAD THE SCREEN AND TRY AGAIN." };

  const ownedMerch = new Set(store.concessionCategories.map((c) => c.id));
  const keepMerchIds = d.concessionCategories.flatMap((c) => (c.id ? [c.id] : []));
  if (keepMerchIds.some((id) => !ownedMerch.has(id)))
    return { ok: false, errors: {}, message: "INVALID MERCHANDISE CATEGORY REFERENCE. RELOAD THE SCREEN AND TRY AGAIN." };

  try {
  await db.$transaction(async (tx) => {
    await tx.store.update({ where: { id: store.id }, data: storeFields(d) });
    await tx.storeSettings.update({ where: { storeId: store.id }, data: settingsFields(d) });
    for (const f of formatRows(d)) {
      // A format's default category must be one of THIS store's kept categories (never trust the browser's id).
      const wanted = d.formatDefaults[f.format];
      const defaultCategoryId = f.enabled && wanted && keepIds.includes(wanted) ? wanted : null;
      await tx.storeFormat.upsert({
        where: { storeId_format: { storeId: store.id, format: f.format } },
        update: { enabled: f.enabled, defaultCategoryId },
        create: { storeId: store.id, ...f, defaultCategoryId },
      });
    }

    for (const [i, c] of d.categories.entries()) {
      if (c.id) await tx.rentalCategory.update({ where: { id: c.id, storeId: store.id }, data: { ...categoryFields(c, i), active: true } });
      else await tx.rentalCategory.create({ data: { storeId: store.id, ...categoryFields(c, i) } });
    }
    // Removed categories: delete if unused, otherwise retire (copies may reference them).
    const removed = store.rentalCategories.map((c) => c.id).filter((id) => !keepIds.includes(id));
    await tx.rentalCategory.deleteMany({ where: { storeId: store.id, id: { in: removed }, inventoryCopies: { none: {} } } });
    await tx.rentalCategory.updateMany({ where: { storeId: store.id, id: { in: removed } }, data: { active: false } });

    // Merchandise categories: same approach. A new name that matches a retired category brings it back.
    for (const [i, c] of d.concessionCategories.entries()) {
      const fields = concessionCategoryFields(c, i);
      if (c.id) {
        await tx.concessionCategory.update({ where: { id: c.id, storeId: store.id }, data: { ...fields, active: true } });
      } else {
        const existing = await tx.concessionCategory.findUnique({ where: { storeId_name: { storeId: store.id, name: fields.name } } });
        if (existing) await tx.concessionCategory.update({ where: { id: existing.id, storeId: store.id }, data: { ...fields, active: true } });
        else await tx.concessionCategory.create({ data: { storeId: store.id, ...fields } });
      }
    }
    const removedMerch = store.concessionCategories.map((c) => c.id).filter((id) => !keepMerchIds.includes(id));
    await tx.concessionCategory.deleteMany({ where: { storeId: store.id, id: { in: removedMerch }, items: { none: {} } } });
    await tx.concessionCategory.updateMany({ where: { storeId: store.id, id: { in: removedMerch } }, data: { active: false } });
  });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, errors: {}, message: "TWO CATEGORIES WOULD SHARE A NAME. RENAME ONE, SAVE, THEN RENAME THE OTHER." };
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/menu?saved=1");
}

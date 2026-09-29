"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { loadSampleData } from "@/lib/sample-store";
import { getUserStore, requireStore, requireUser } from "@/lib/store-access";
import { storeSchema, zodErrors, type ActionState, type StoreFormValues } from "@/lib/validation";
import type { MediaFormat } from "@/generated/prisma/client";

type Parsed = ReturnType<typeof storeSchema.parse>;

const ALL_FORMATS: MediaFormat[] = ["VHS", "DVD", "BLURAY", "LASERDISC", "VIDEO_GAME", "OTHER"];

const storeFields = (d: Parsed) => ({
  name: d.name,
  number: d.number.padStart(4, "0"),
  address: d.address,
  city: d.city,
  region: d.region,
  postalCode: d.postalCode,
  phone: d.phone,
  managerName: d.managerName,
  slogan: d.slogan || null,
});

const settingsFields = (d: Parsed) => ({
  currency: d.currency,
  timezone: d.timezone,
  salesTaxPercent: d.salesTaxPercent.toString(),
  storeYear: d.storeYear,
  onlyMoviesUpToStoreYear: d.storeYear !== null && d.onlyMoviesUpToStoreYear,
  rewindFee: d.rewindFee.toFixed(2),
  damageFee: d.damageFee.toFixed(2),
  lostItemFee: d.lostItemFee.toFixed(2),
  replacementFee: d.replacementFee.toFixed(2),
  membershipFee: d.membershipFee.toFixed(2),
  membershipTermMonths: d.membershipTermMonths,
  maxRentalsOut: d.maxRentalsOut,
  defaultLowStockThreshold: d.defaultLowStock,
  functionKeys: d.functionKeys,
  receiptFooter: d.receiptFooter || "THANK YOU!",
});

const formatRows = (d: Parsed) =>
  ALL_FORMATS.map((format) => ({ format, enabled: d.formats.includes(format) }));

const categoryFields = (c: Parsed["categories"][number], sortOrder: number) => ({
  name: c.name,
  rentalPrice: c.rentalPrice.toFixed(2),
  rentalDays: c.rentalDays,
  lateFeePerDay: c.lateFeePerDay.toFixed(2),
  sortOrder,
});

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
  });

  revalidatePath("/", "layout");
  redirect("/menu?saved=1");
}

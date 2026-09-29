"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type MediaFormat } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { FORMAT_CODES, buildSearchText } from "@/lib/inventory";
import { requireStore } from "@/lib/store-access";
import {
  addCopiesSchema, addTitleSchema, copyEditSchema, zodErrors,
  type ActionState, type AddCopiesValues, type AddTitleValues, type CopyEditValues,
} from "@/lib/validation";

const fail = (errors: Record<string, string>, message = "PLEASE CORRECT THE FIELDS MARKED BELOW"): ActionState => ({ ok: false, errors, message });
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);

type Store = Awaited<ReturnType<typeof requireStore>>["store"];

/** Format must be carried by the store; category must belong to this store and be active. */
function checkPolicy(store: Store, format: string, categoryId: string): ActionState {
  if (!store.formats.some((f) => f.enabled && f.format === format))
    return fail({ format: "THIS STORE DOES NOT CARRY THAT FORMAT. ENABLE IT IN STORE SETTINGS FIRST." });
  if (!store.rentalCategories.some((c) => c.id === categoryId)) return fail({ categoryId: "SELECT A VALID RENTAL CATEGORY" });
  return undefined;
}

/** Creates `quantity` individual copy records with store-unique copy numbers. */
async function createCopies(
  tx: Prisma.TransactionClient,
  storeId: string,
  movieTitleId: string,
  o: { format: MediaFormat; categoryId: string; quantity: number; replacementCost: number },
) {
  const { nextCopyNumber } = await tx.store.update({
    where: { id: storeId },
    data: { nextCopyNumber: { increment: o.quantity } },
    select: { nextCopyNumber: true },
  });
  const first = nextCopyNumber - o.quantity;
  await tx.inventoryCopy.createMany({
    data: Array.from({ length: o.quantity }, (_, i) => ({
      storeId,
      movieTitleId,
      copyNumber: `${FORMAT_CODES[o.format]}-${String(first + i).padStart(6, "0")}`,
      format: o.format,
      condition: "GOOD",
      rentalCategoryId: o.categoryId,
      replacementCost: o.replacementCost.toFixed(2),
    })),
  });
}

/** Add a title (or, if it already exists in this store, add copies to the existing title). */
export async function addTitle(input: AddTitleValues): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = addTitleSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const d = parsed.data;
  const policy = checkPolicy(store, d.format, d.categoryId);
  if (policy) return policy;

  const genres = splitList(d.genres);
  const cast = splitList(d.cast);
  const tmdbId = d.tmdbId ? Number(d.tmdbId) : null;

  const run = () =>
    db.$transaction(async (tx) => {
      const existing = tmdbId
        ? await tx.movieTitle.findFirst({ where: { storeId: store.id, tmdbId } })
        : await tx.movieTitle.findFirst({ where: { storeId: store.id, tmdbId: null, year: d.year, title: { equals: d.title, mode: "insensitive" } } });
      const title =
        existing ??
        (await tx.movieTitle.create({
          data: {
            storeId: store.id, title: d.title, year: d.year, tmdbId, overview: d.overview || null,
            posterPath: d.posterPath || null, director: d.director || null, runtimeMinutes: d.runtime,
            genres, cast, rating: d.rating || null, searchText: buildSearchText(d.director, genres, cast),
          },
        }));
      await createCopies(tx, store.id, title.id, { format: d.format as MediaFormat, categoryId: d.categoryId, quantity: d.quantity, replacementCost: d.replacementCost });
      return title.id;
    });

  let titleId: string;
  try {
    titleId = await run();
  } catch (e) {
    // A concurrent add of the same TMDB movie hit the unique index: retry once, which finds the existing row.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") titleId = await run();
    else throw e;
  }
  revalidatePath("/inventory");
  redirect(`/inventory/${titleId}?added=${d.quantity}`);
}

export async function addCopies(titleId: string, input: AddCopiesValues): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = addCopiesSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const d = parsed.data;
  const policy = checkPolicy(store, d.format, d.categoryId);
  if (policy) return policy;
  const title = await db.movieTitle.findFirst({ where: { id: titleId, storeId: store.id }, select: { id: true } });
  if (!title) return fail({}, "TITLE NOT FOUND");

  await db.$transaction((tx) =>
    createCopies(tx, store.id, title.id, { format: d.format as MediaFormat, categoryId: d.categoryId, quantity: d.quantity, replacementCost: d.replacementCost }),
  );
  revalidatePath("/inventory");
  redirect(`/inventory/${titleId}?added=${d.quantity}`);
}

export async function updateCopy(copyId: string, input: CopyEditValues): Promise<ActionState> {
  const { store } = await requireStore();
  const parsed = copyEditSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrors(parsed.error));
  const d = parsed.data;
  if (!store.rentalCategories.some((c) => c.id === d.categoryId)) return fail({ categoryId: "SELECT A VALID RENTAL CATEGORY" });

  const copy = await db.inventoryCopy.findFirst({ where: { id: copyId, storeId: store.id } });
  if (!copy) return fail({}, "COPY NOT FOUND");
  // RENTED/OVERDUE are controlled by the rental workflow, so status is left untouched while a copy is out.
  const isOut = copy.status === "RENTED" || copy.status === "OVERDUE";

  try {
    await db.inventoryCopy.update({
      where: { id: copy.id, storeId: store.id },
      data: {
        status: isOut ? undefined : d.status, condition: d.condition, rentalCategoryId: d.categoryId, barcode: d.barcode || null,
        replacementCost: d.replacementCost.toFixed(2), notes: d.notes || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail({ barcode: "THAT BARCODE IS ALREADY ASSIGNED TO ANOTHER COPY" });
    throw e;
  }
  revalidatePath("/inventory");
  redirect(`/inventory/${copy.movieTitleId}?copy=${copy.copyNumber}`);
}

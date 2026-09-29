"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SampleDataError, clearStoreData, loadSampleData } from "@/lib/sample-store";
import { requireStore } from "@/lib/store-access";
import type { ActionState } from "@/lib/validation";

const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

/** Load the demo store data into the current (empty) store. */
export async function loadSample(): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  if (role === "EMPLOYEE") return { ok: false, errors: {}, message: "MANAGER OVERRIDE REQUIRED TO LOAD SAMPLE DATA" };
  try {
    await db.$transaction((tx) => loadSampleData(tx, store.id, user.id), TX_OPTIONS);
  } catch (e) {
    if (e instanceof SampleDataError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/menu?sample=1");
}

/** Wipe customers, inventory, merchandise, rentals and transactions (store settings are kept). Owner only. */
export async function clearData(confirm: string): Promise<ActionState> {
  const { store, role } = await requireStore();
  if (role !== "OWNER") return { ok: false, errors: {}, message: "ONLY THE STORE OWNER CAN CLEAR STORE DATA" };
  if (confirm !== "CLEAR") return { ok: false, errors: { confirm: 'TYPE THE WORD "CLEAR" TO CONFIRM' }, message: "CONFIRMATION REQUIRED" };
  await db.$transaction((tx) => clearStoreData(tx, store.id), TX_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/menu?cleared=1");
}

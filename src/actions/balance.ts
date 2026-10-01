"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { CreditError } from "@/lib/credit-ops";
import { BalanceOpError, payBalance, waiveBalance } from "@/lib/balance-ops";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { balancePaySchema, balanceWaiveSchema, zodErrors, type ActionState } from "@/lib/validation";

function revalidateAll() {
  for (const p of ["/customers", "/transactions", "/reports", "/overdue"]) revalidatePath(p);
}

export async function payBalanceAction(customerId: string, input: { amount: string; paymentMethod: string; tendered: string }): Promise<ActionState> {
  const { store, user } = await requireStore();
  const parsed = balancePaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  let transactionId: string;
  try {
    ({ transactionId } = await db.$transaction((tx) =>
      payBalance(tx, { storeId: store.id, userId: user.id, customerId, amountRaw: parsed.data.amount, method: parsed.data.paymentMethod as PaymentMethod, tenderedRaw: input.tendered }),
    ));
  } catch (e) {
    if (e instanceof BalanceOpError || e instanceof CreditError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidateAll();
  redirect(`/receipt/${transactionId}?new=1`);
}

/** Waiving is a manager function (re-checked here, not just hidden in the UI). */
export async function waiveBalanceAction(customerId: string, input: { amount: string; reason: string }): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  if (role === "EMPLOYEE") return { ok: false, errors: {}, message: "ONLY AN OWNER OR MANAGER CAN WAIVE A BALANCE." };
  const parsed = balanceWaiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  let transactionId: string;
  try {
    ({ transactionId } = await db.$transaction((tx) =>
      waiveBalance(tx, { storeId: store.id, userId: user.id, customerId, amountRaw: parsed.data.amount, reason: parsed.data.reason }),
    ));
  } catch (e) {
    if (e instanceof BalanceOpError || e instanceof CreditError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidateAll();
  redirect(`/receipt/${transactionId}?new=1`);
}

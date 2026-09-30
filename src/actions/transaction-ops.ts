"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { refundTransaction, TransactionOpError, voidTransaction } from "@/lib/transaction-ops";
import { refundSchema, voidSchema, zodErrors, type ActionState, type RefundValues } from "@/lib/validation";

// Voids and refunds are manager functions: an EMPLOYEE account cannot perform them (re-checked here, not just hidden in the UI).
const DENIED: ActionState = { ok: false, errors: {}, message: "ONLY AN OWNER OR MANAGER CAN VOID OR REFUND A TRANSACTION." };

function revalidateAll() {
  for (const p of ["/transactions", "/inventory", "/concessions", "/return", "/customers", "/reports"]) revalidatePath(p);
}

export async function voidTransactionAction(transactionId: string, input: { reason: string }): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  if (role === "EMPLOYEE") return DENIED;
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  try {
    await db.$transaction((tx) => voidTransaction(tx, { storeId: store.id, userId: user.id, transactionId, reason: parsed.data.reason }));
  } catch (e) {
    if (e instanceof TransactionOpError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidateAll();
  redirect(`/transactions/${transactionId}`);
}

export async function refundTransactionAction(transactionId: string, input: RefundValues): Promise<ActionState> {
  const { store, user, role } = await requireStore();
  if (role === "EMPLOYEE") return DENIED;
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  let refundId: string;
  try {
    refundId = (
      await db.$transaction((tx) =>
        refundTransaction(tx, { storeId: store.id, userId: user.id, transactionId, request: { ...parsed.data, paymentMethod: parsed.data.paymentMethod as PaymentMethod } }),
      )
    ).refundId;
  } catch (e) {
    if (e instanceof TransactionOpError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  revalidateAll();
  redirect(`/receipt/${refundId}?new=1`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/generated/prisma/client";
import { CreditError, sellCredit } from "@/lib/credit-ops";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { creditSaleSchema, zodErrors, type ActionState } from "@/lib/validation";

export async function sellCreditAction(customerId: string, input: { amount: string; paymentMethod: string; tendered: string }): Promise<ActionState> {
  const { store, user } = await requireStore();
  const parsed = creditSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  let transactionId: string;
  try {
    ({ transactionId } = await db.$transaction((tx) =>
      sellCredit(tx, { storeId: store.id, userId: user.id, customerId, amountRaw: parsed.data.amount, method: parsed.data.paymentMethod as PaymentMethod, tenderedRaw: input.tendered }),
    ));
  } catch (e) {
    if (e instanceof CreditError) return { ok: false, errors: {}, message: e.message };
    throw e;
  }
  for (const p of ["/customers", "/transactions", "/reports"]) revalidatePath(p);
  redirect(`/receipt/${transactionId}?new=1`);
}

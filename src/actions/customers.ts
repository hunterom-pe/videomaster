"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveTender } from "@/lib/cash";
import { CreditError, creditUsedChange, spendCredit } from "@/lib/credit-ops";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { renewedExpiry } from "@/lib/membership";
import { fromCents, toCents } from "@/lib/pricing";
import { PAYMENT_METHODS } from "@/lib/validation";
import type { PaymentMethod } from "@/generated/prisma/client";
import { customerSchema, zodErrors, type ActionState, type CustomerFormValues } from "@/lib/validation";

type Parsed = ReturnType<typeof customerSchema.parse>;

const fields = (d: Parsed) => ({
  firstName: d.firstName,
  lastName: d.lastName,
  phone: d.phone || null,
  phoneDigits: d.phone.replace(/\D/g, "") || null,
  email: d.email || null,
  address: d.address || null,
  city: d.city || null,
  region: d.region || null,
  postalCode: d.postalCode || null,
  dateOfBirth: d.dateOfBirth,
  status: d.status,
  notes: d.notes || null,
});

function validate(input: CustomerFormValues) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success)
    return { state: { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" } satisfies ActionState };
  return { data: parsed.data };
}

export async function createCustomer(input: CustomerFormValues): Promise<ActionState> {
  const { store, user } = await requireStore();
  const v = validate(input);
  if ("state" in v) return v.state;

  const settings = store.settings!;
  const feeCents = toCents(settings.membershipFee);
  const collect = feeCents > 0 && input.collectFee === true;
  const method = PAYMENT_METHODS.find((p) => p.value === input.paymentMethod)?.value;
  if (collect && !method) return { ok: false, errors: { paymentMethod: "SELECT A PAYMENT METHOD" }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };

  if (collect && method === "STORE_CREDIT") return { ok: false, errors: { paymentMethod: "A NEW CUSTOMER HAS NO STORE CREDIT" }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  const tender = collect && method ? resolveTender(method, feeCents, input.tendered) : ({ ok: true, tenderedCents: null } as const);
  if (!tender.ok) return { ok: false, errors: { tendered: tender.message }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };

  const now = new Date();
  const { customer, transactionId } = await db.$transaction(async (tx) => {
    // Atomic per-store counter: concurrent creates can never share a membership number.
    const { nextMembershipNumber } = await tx.store.update({
      where: { id: store.id },
      data: { nextMembershipNumber: { increment: 1 } },
      select: { nextMembershipNumber: true },
    });
    const membershipNumber = String(nextMembershipNumber - 1).padStart(6, "0");
    // Term starts when the fee is collected; a waived fee leaves expiry untracked.
    const membership = collect ? { membershipPaidAt: now, membershipExpiresAt: renewedExpiry(null, now, settings.membershipTermMonths) } : {};
    const customer = await tx.customer.create({ data: { storeId: store.id, membershipNumber, ...fields(v.data), ...membership } });
    let transactionId: string | null = null;
    if (collect) {
      const { nextTransactionNumber } = await tx.store.update({ where: { id: store.id }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
      transactionId = (
        await tx.transaction.create({
          data: {
            storeId: store.id, number: nextTransactionNumber - 1, type: "MEMBERSHIP_FEE", customerId: customer.id, createdById: user.id,
            subtotal: fromCents(feeCents), tax: "0.00", total: fromCents(feeCents), paymentMethod: method as PaymentMethod, notes: "MEMBERSHIP FEE",
            tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents),
          },
        })
      ).id;
    }
    return { customer, transactionId };
  });
  revalidatePath("/customers");
  revalidatePath("/transactions");
  redirect(transactionId ? `/receipt/${transactionId}?new=1` : `/customers/${customer.id}?saved=1`);
}

/** Collect the membership fee (if any) and extend the term. */
export async function renewMembership(customerId: string, paymentMethod: string, tenderedRaw?: string): Promise<ActionState> {
  const { store, user } = await requireStore();
  const settings = store.settings!;
  const feeCents = toCents(settings.membershipFee);
  const method = PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.value;
  if (feeCents > 0 && !method) return { ok: false, errors: { paymentMethod: "SELECT A PAYMENT METHOD" }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };

  const tender = feeCents > 0 && method ? resolveTender(method, feeCents, tenderedRaw) : ({ ok: true, tenderedCents: null } as const);
  if (!tender.ok) return { ok: false, errors: { tendered: tender.message }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };

  const now = new Date();
  let transactionId: string | null;
  try {
  transactionId = await db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId, storeId: store.id } });
    if (!c) return null;
    await tx.customer.update({
      where: { id: c.id, storeId: store.id },
      data: { membershipPaidAt: now, membershipExpiresAt: renewedExpiry(c.membershipExpiresAt, now, settings.membershipTermMonths) },
    });
    if (feeCents <= 0) return "none";
    if (method === "STORE_CREDIT") await spendCredit(tx, { storeId: store.id, customerId: c.id, cents: feeCents });
    const { nextTransactionNumber } = await tx.store.update({ where: { id: store.id }, data: { nextTransactionNumber: { increment: 1 } }, select: { nextTransactionNumber: true } });
    return (
      await tx.transaction.create({
        data: {
          storeId: store.id, number: nextTransactionNumber - 1, type: "MEMBERSHIP_FEE", customerId: c.id, createdById: user.id,
          subtotal: fromCents(feeCents), tax: "0.00", total: fromCents(feeCents), paymentMethod: method as PaymentMethod, notes: "MEMBERSHIP RENEWAL",
          tendered: tender.tenderedCents === null ? null : fromCents(tender.tenderedCents),
          creditChange: creditUsedChange(method as string, feeCents),
        },
      })
    ).id;
  });
  } catch (e) {
    if (e instanceof CreditError) return { ok: false, errors: { paymentMethod: e.message }, message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
    throw e;
  }
  if (!transactionId) return { ok: false, errors: {}, message: "CUSTOMER NOT FOUND" };
  revalidatePath("/customers");
  redirect(transactionId === "none" ? `/customers/${customerId}?saved=1` : `/receipt/${transactionId}?new=1`);
}

export async function updateCustomer(customerId: string, input: CustomerFormValues): Promise<ActionState> {
  const { store } = await requireStore();
  const v = validate(input);
  if ("state" in v) return v.state;

  // Ownership check is part of the write itself: the row must belong to the session's store.
  const result = await db.customer.updateMany({ where: { id: customerId, storeId: store.id }, data: fields(v.data) });
  if (result.count === 0) return { ok: false, errors: {}, message: "CUSTOMER NOT FOUND" };
  revalidatePath("/customers");
  redirect(`/customers/${customerId}?saved=1`);
}

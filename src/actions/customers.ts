"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
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
  const { store } = await requireStore();
  const v = validate(input);
  if ("state" in v) return v.state;

  const customer = await db.$transaction(async (tx) => {
    // Atomic per-store counter: concurrent creates can never share a membership number.
    const { nextMembershipNumber } = await tx.store.update({
      where: { id: store.id },
      data: { nextMembershipNumber: { increment: 1 } },
      select: { nextMembershipNumber: true },
    });
    const membershipNumber = String(nextMembershipNumber - 1).padStart(6, "0");
    return tx.customer.create({ data: { storeId: store.id, membershipNumber, ...fields(v.data) } });
  });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}?saved=1`);
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

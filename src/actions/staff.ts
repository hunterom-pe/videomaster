"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isRateLimited, recordFailure } from "@/lib/rate-limit";
import { deleteOtherSessions } from "@/lib/session";
import { StaffError, addStaff, removeStaff, resetStaffPassword, setStaffRole } from "@/lib/staff-ops";
import { requireStore } from "@/lib/store-access";
import { addStaffSchema, changePasswordSchema, staffPasswordSchema, zodErrors, type ActionState } from "@/lib/validation";

const OK: ActionState = undefined;
const fail = (message: string, errors: Record<string, string> = {}): ActionState => ({ ok: false, errors, message });

/** Staff management is the store owner's job; re-checked here on every call, not just hidden in the UI. */
async function ownerOnly() {
  const ctx = await requireStore();
  return ctx.role === "OWNER" ? ctx : null;
}

async function guarded(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof StaffError) return fail(e.message);
    throw e;
  }
  revalidatePath("/settings/staff");
  return OK;
}

export async function addStaffAction(input: { email: string; role: string; password: string }): Promise<ActionState> {
  const ctx = await ownerOnly();
  if (!ctx) return fail("ONLY THE STORE OWNER CAN MANAGE STAFF ACCOUNTS.");
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  const passwordHash = await hashPassword(parsed.data.password);
  return guarded(() => db.$transaction((tx) => addStaff(tx, { storeId: ctx.store.id, email: parsed.data.email, role: parsed.data.role, passwordHash })));
}

export async function setStaffRoleAction(memberId: string, role: string): Promise<ActionState> {
  const ctx = await ownerOnly();
  if (!ctx) return fail("ONLY THE STORE OWNER CAN MANAGE STAFF ACCOUNTS.");
  if (role !== "MANAGER" && role !== "EMPLOYEE") return fail("SELECT A ROLE");
  return guarded(() => db.$transaction((tx) => setStaffRole(tx, { storeId: ctx.store.id, memberId, role })));
}

export async function resetStaffPasswordAction(memberId: string, input: { password: string }): Promise<ActionState> {
  const ctx = await ownerOnly();
  if (!ctx) return fail("ONLY THE STORE OWNER CAN MANAGE STAFF ACCOUNTS.");
  const parsed = staffPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  const passwordHash = await hashPassword(parsed.data.password);
  return guarded(() => db.$transaction((tx) => resetStaffPassword(tx, { storeId: ctx.store.id, memberId, passwordHash })));
}

export async function removeStaffAction(memberId: string): Promise<ActionState> {
  const ctx = await ownerOnly();
  if (!ctx) return fail("ONLY THE STORE OWNER CAN MANAGE STAFF ACCOUNTS.");
  return guarded(() => db.$transaction((tx) => removeStaff(tx, { storeId: ctx.store.id, memberId })));
}

/** Any signed-in user changes their OWN password (current password required). Other sessions are signed out. */
export async function changeOwnPassword(input: { current: string; password: string; confirm: string }): Promise<ActionState> {
  const { user } = await requireStore();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS MARKED BELOW" };
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, isDemo: true } });
  if (!row || row.isDemo) return fail("THIS ACCOUNT'S PASSWORD CANNOT BE CHANGED.");
  const keys = [`pw:${user.id}`]; // same DB-backed limit as log-on: a stolen session can't guess the current password
  if (await isRateLimited(keys)) return fail("TOO MANY WRONG PASSWORDS. WAIT 15 MINUTES AND TRY AGAIN.");
  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
    await recordFailure(keys, user.id);
    return fail("YOUR CURRENT PASSWORD IS INCORRECT.", { current: "INCORRECT PASSWORD" });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await deleteOtherSessions(user.id);
  return OK; // success: the form shows its own confirmation
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Staff accounts for one store. Plain functions over a database transaction (no session): the server actions do the
// "owner only" check, and every function re-verifies that the member belongs to the given store. Only the owner can
// create staff; the OWNER member can never be changed or removed here. Removing staff DISABLES the account (no password,
// no membership, sessions deleted) instead of deleting it, so past transactions still show who rang them up.

type Tx = Prisma.TransactionClient;
export class StaffError extends Error {}
export const STAFF_ROLES = ["MANAGER", "EMPLOYEE"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const DISABLED_HASH = "!"; // never matches a password

async function staffMember(tx: Tx, storeId: string, memberId: string) {
  const m = await tx.storeMember.findFirst({ where: { id: memberId, storeId }, include: { user: { select: { id: true, email: true } } } });
  if (!m) throw new StaffError("THAT STAFF MEMBER WAS NOT FOUND IN THIS STORE.");
  if (m.role === "OWNER") throw new StaffError("THE STORE OWNER'S ACCOUNT CANNOT BE CHANGED HERE.");
  return m;
}

export async function addStaff(tx: Tx, o: { storeId: string; email: string; role: StaffRole; passwordHash: string }) {
  const email = o.email.trim().toLowerCase();
  const existing = await tx.user.findUnique({ where: { email }, include: { memberships: { select: { id: true } } } });
  if (existing) {
    // A previously removed staff member (disabled, no store) can be re-hired with a new password. Nothing else can be taken over.
    const rehire = !existing.isDemo && existing.passwordHash === DISABLED_HASH && existing.memberships.length === 0;
    if (!rehire) throw new StaffError("AN ACCOUNT WITH THIS E-MAIL ALREADY EXISTS, SO IT CANNOT BE ADDED AS STAFF.");
    await tx.user.update({ where: { id: existing.id }, data: { passwordHash: o.passwordHash } });
    return (await tx.storeMember.create({ data: { userId: existing.id, storeId: o.storeId, role: o.role } })).id;
  }
  const user = await tx.user.create({ data: { email, passwordHash: o.passwordHash } });
  return (await tx.storeMember.create({ data: { userId: user.id, storeId: o.storeId, role: o.role } })).id;
}

export async function setStaffRole(tx: Tx, o: { storeId: string; memberId: string; role: StaffRole }) {
  const m = await staffMember(tx, o.storeId, o.memberId);
  await tx.storeMember.update({ where: { id: m.id }, data: { role: o.role } });
}

export async function resetStaffPassword(tx: Tx, o: { storeId: string; memberId: string; passwordHash: string }) {
  const m = await staffMember(tx, o.storeId, o.memberId);
  await tx.user.update({ where: { id: m.userId }, data: { passwordHash: o.passwordHash } });
  await tx.session.deleteMany({ where: { userId: m.userId } }); // they must sign on again with the new password
}

export async function removeStaff(tx: Tx, o: { storeId: string; memberId: string }) {
  const m = await staffMember(tx, o.storeId, o.memberId);
  await tx.session.deleteMany({ where: { userId: m.userId } });
  await tx.storeMember.delete({ where: { id: m.id } });
  await tx.user.update({ where: { id: m.userId }, data: { passwordHash: DISABLED_HASH } });
}

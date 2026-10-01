// Database integration test for staff accounts. Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { DISABLED_HASH, StaffError, addStaff, removeStaff, resetStaffPassword, setStaffRole } from "@/lib/staff-ops";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("staff accounts (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const run = Date.now();
  let storeId = "", otherStoreId = "", ownerId = "", ownerMemberId = "";
  const emails: string[] = [];
  const mail = (n: string) => { const e = `${n}-${run}@staff-test.example.com`; emails.push(e); return e; };
  const fails = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(StaffError);
  const storeData = (name: string) => ({ name, number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T" });

  beforeAll(async () => {
    ownerId = (await db.user.create({ data: { email: mail("owner"), passwordHash: "x" } })).id;
    const store = await db.store.create({ data: { ...storeData("STAFF TEST"), members: { create: { userId: ownerId, role: "OWNER" } } }, include: { members: true } });
    storeId = store.id; ownerMemberId = store.members[0].id;
    otherStoreId = (await db.store.create({ data: storeData("OTHER") })).id;
  });

  afterAll(async () => {
    await db.storeMember.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } });
    await db.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  });

  it("adds staff, refuses an existing e-mail, and cannot take over other accounts", async () => {
    const e = mail("clerk");
    const id = await db.$transaction((tx) => addStaff(tx, { storeId, email: e.toUpperCase(), role: "EMPLOYEE", passwordHash: "hash1" }));
    const m = await db.storeMember.findUniqueOrThrow({ where: { id }, include: { user: true } });
    expect([m.role, m.user.email, m.storeId]).toEqual(["EMPLOYEE", e, storeId]);
    await fails(db.$transaction((tx) => addStaff(tx, { storeId, email: e, role: "MANAGER", passwordHash: "h" })));
    await fails(db.$transaction((tx) => addStaff(tx, { storeId, email: emails[0], role: "MANAGER", passwordHash: "h" }))); // the owner's own account
    const demo = mail("demo"); await db.user.create({ data: { email: demo, passwordHash: DISABLED_HASH, isDemo: true } });
    await fails(db.$transaction((tx) => addStaff(tx, { storeId, email: demo, role: "MANAGER", passwordHash: "h" }))); // demo accounts are never re-hired
  });

  it("changes roles, but never the owner and never across stores", async () => {
    const m = await db.storeMember.findFirstOrThrow({ where: { storeId, role: "EMPLOYEE" } });
    await db.$transaction((tx) => setStaffRole(tx, { storeId, memberId: m.id, role: "MANAGER" }));
    expect((await db.storeMember.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("MANAGER");
    await fails(db.$transaction((tx) => setStaffRole(tx, { storeId, memberId: ownerMemberId, role: "EMPLOYEE" })));
    await fails(db.$transaction((tx) => setStaffRole(tx, { storeId: otherStoreId, memberId: m.id, role: "EMPLOYEE" })));
    await fails(db.$transaction((tx) => removeStaff(tx, { storeId, memberId: ownerMemberId })));
    await fails(db.$transaction((tx) => resetStaffPassword(tx, { storeId, memberId: ownerMemberId, passwordHash: "h" })));
  });

  it("reset signs the person out; remove disables the account but keeps the row; re-hire works", async () => {
    const e = mail("temp");
    const id = await db.$transaction((tx) => addStaff(tx, { storeId, email: e, role: "EMPLOYEE", passwordHash: "old" }));
    const userId = (await db.storeMember.findUniqueOrThrow({ where: { id } })).userId;
    await db.session.create({ data: { userId, tokenHash: `t-${run}-1`, expiresAt: new Date(Date.now() + 3_600_000) } });
    await db.$transaction((tx) => resetStaffPassword(tx, { storeId, memberId: id, passwordHash: "new" }));
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash).toBe("new");
    expect(await db.session.count({ where: { userId } })).toBe(0);

    await db.session.create({ data: { userId, tokenHash: `t-${run}-2`, expiresAt: new Date(Date.now() + 3_600_000) } });
    await db.$transaction((tx) => removeStaff(tx, { storeId, memberId: id }));
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).toBe(DISABLED_HASH);
    expect(await db.storeMember.count({ where: { userId } })).toBe(0);
    expect(await db.session.count({ where: { userId } })).toBe(0);

    const again = await db.$transaction((tx) => addStaff(tx, { storeId, email: e, role: "MANAGER", passwordHash: "rehired" }));
    const m = await db.storeMember.findUniqueOrThrow({ where: { id: again }, include: { user: true } });
    expect([m.userId, m.role, m.user.passwordHash]).toEqual([userId, "MANAGER", "rehired"]);
  });
});

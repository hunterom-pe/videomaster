// Database integration test for demo mode. Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createDemoAccount, purgeOldDemos } from "@/lib/demo";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("demo mode (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  afterAll(() => db.$disconnect());

  it("creates isolated, fully stocked demo stores and purges only expired ones", async () => {
    const a = await createDemoAccount(db);
    const b = await createDemoAccount(db);
    const storeOf = async (userId: string) => (await db.storeMember.findFirstOrThrow({ where: { userId } })).storeId;
    const [sa, sb] = [await storeOf(a), await storeOf(b)];
    expect(sa).not.toBe(sb);
    expect(await db.customer.count({ where: { storeId: sa } })).toBe(22);
    expect(await db.movieTitle.count({ where: { storeId: sa } })).toBe(28);
    expect(await db.transaction.count({ where: { storeId: sa } })).toBeGreaterThan(20);
    const user = await db.user.findUniqueOrThrow({ where: { id: a } });
    expect(user.isDemo).toBe(true);
    expect(user.passwordHash).toBe("!"); // can never be logged on to with a password

    // age only `a`, purge, and check `b` survives
    await db.user.update({ where: { id: a }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    await purgeOldDemos(db);
    expect(await db.user.findUnique({ where: { id: a } })).toBeNull();
    expect(await db.store.findUnique({ where: { id: sa } })).toBeNull();
    expect(await db.customer.count({ where: { storeId: sa } })).toBe(0);
    expect(await db.store.findUnique({ where: { id: sb } })).not.toBeNull();

    await db.user.update({ where: { id: b }, data: { createdAt: new Date(0) } });
    await purgeOldDemos(db); // clean up
    expect(await db.store.findUnique({ where: { id: sb } })).toBeNull();
  });
});

// Database integration test for customer account balances. Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { BalanceOpError, payBalance, waiveBalance } from "@/lib/balance-ops";
import { toCents } from "@/lib/pricing";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("account balances (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = "", userId = "", customerId = "", otherStoreId = "";
  const run = Date.now();
  const base = () => ({ storeId, userId, customerId });
  const fails = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(BalanceOpError);
  const balance = async () => toCents((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).outstandingFees);
  const ledger = async () => {
    const r = await db.transaction.aggregate({ where: { customerId, voidedAt: null }, _sum: { balanceChange: true } });
    return toCents(r._sum.balanceChange ?? 0);
  };
  const storeData = (name: string) => ({ name, number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T" });

  beforeAll(async () => {
    userId = (await db.user.create({ data: { email: `bal-test-${run}@example.com`, passwordHash: "x" } })).id;
    storeId = (await db.store.create({ data: { ...storeData("BAL TEST"), members: { create: { userId, role: "OWNER" } } } })).id;
    otherStoreId = (await db.store.create({ data: storeData("OTHER") })).id;
    customerId = (await db.customer.create({ data: { storeId, membershipNumber: "000001", firstName: "A", lastName: "B" } })).id;
    // a return that put $6.00 of fees on account
    await db.$transaction(async (tx) => {
      await tx.transaction.create({ data: { storeId, number: 1, type: "RETURN", customerId, subtotal: "1.00", tax: "0", total: "1.00", balanceChange: "6.00", notes: "TEST" } });
      await tx.customer.update({ where: { id: customerId }, data: { outstandingFees: "6.00" } });
      await tx.store.update({ where: { id: storeId }, data: { nextTransactionNumber: 2 } });
    });
  });

  afterAll(async () => {
    for (const id of [storeId, otherStoreId]) {
      await db.transaction.deleteMany({ where: { storeId: id } });
      await db.customer.deleteMany({ where: { storeId: id } });
      await db.storeMember.deleteMany({ where: { storeId: id } });
      await db.store.delete({ where: { id } });
    }
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("pays part of a balance with cash and change", async () => {
    const r = await db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "2.50", method: "CASH", tenderedRaw: "5" }));
    expect(r.cents).toBe(250);
    expect(await balance()).toBe(350);
    const t = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId } });
    expect(t.type).toBe("ACCOUNT_PAYMENT");
    expect(toCents(t.tendered!)).toBe(500);
    expect(toCents(t.balanceChange)).toBe(-250);
  });

  it("rejects overpayment, zero, short cash, and other stores' customers", async () => {
    await fails(db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "3.51", method: "CARD" as never })));
    await fails(db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "0", method: "CHECK" })));
    await fails(db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "3.00", method: "CASH", tenderedRaw: "2" })));
    await fails(db.$transaction((tx) => payBalance(tx, { storeId: otherStoreId, userId, customerId, amountRaw: "1", method: "CHECK" })));
    expect(await balance()).toBe(350);
  });

  it("waives part, then pays the rest; the balance never goes negative", async () => {
    await db.$transaction((tx) => waiveBalance(tx, { ...base(), amountRaw: "1", reason: "GOODWILL" }));
    expect(await balance()).toBe(250);
    await db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "", method: "CHECK" }));
    expect(await balance()).toBe(0);
    await fails(db.$transaction((tx) => payBalance(tx, { ...base(), amountRaw: "", method: "CHECK" }))); // nothing left
    await fails(db.$transaction((tx) => waiveBalance(tx, { ...base(), amountRaw: "0.01", reason: "X" })));
  });

  it("keeps Customer.outstandingFees equal to the sum of balanceChange", async () => {
    expect(await ledger()).toBe(await balance());
  });
});

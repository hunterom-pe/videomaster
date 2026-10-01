// Database integration test for store credit. Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { payBalance } from "@/lib/balance-ops";
import { CreditError, sellCredit, spendCredit } from "@/lib/credit-ops";
import { toCents } from "@/lib/pricing";
import { clearStoreData, loadSampleData } from "@/lib/sample-store";
import { refundTransaction, voidTransaction } from "@/lib/transaction-ops";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("store credit (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = "", userId = "", customerId = "";
  const run = Date.now();
  const fails = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(CreditError);
  const credit = async () => toCents((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).storeCredit);
  const ledger = async () => toCents((await db.transaction.aggregate({ where: { customerId, voidedAt: null }, _sum: { creditChange: true } }))._sum.creditChange ?? 0);
  const refundReq = (over: object = {}) => ({ reason: "TEST", paymentMethod: "STORE_CREDIT" as const, merchandise: [], rentalIds: [], wholeFee: false, ...over });

  beforeAll(async () => {
    userId = (await db.user.create({ data: { email: `credit-test-${run}@example.com`, passwordHash: "x" } })).id;
    storeId = (
      await db.store.create({
        data: {
          name: "CREDIT TEST", number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T",
          members: { create: { userId, role: "OWNER" } },
          settings: { create: { salesTaxPercent: "8.6", timezone: "America/Phoenix", storeYear: 1996, rewindFee: "1.00", damageFee: "5.00", lostItemFee: "2.00", membershipFee: "10.00", membershipTermMonths: 12 } },
          formats: { create: [{ format: "VHS", enabled: true }] },
          rentalCategories: {
            create: [
              { name: "NEW RELEASE", rentalPrice: "3.99", rentalDays: 2, lateFeePerDay: "1.00", sortOrder: 0 },
              { name: "CATALOG", rentalPrice: "1.99", rentalDays: 5, lateFeePerDay: "1.00", maxLateFee: "10.00", sortOrder: 1 },
              { name: "KIDS", rentalPrice: "0.99", rentalDays: 5, lateFeePerDay: "0.50", sortOrder: 2 },
            ],
          },
        },
      })
    ).id;
    await db.$transaction((tx) => loadSampleData(tx, storeId, userId, new Date()), { timeout: 60_000 });
    // a customer with an open balance to pay down, and an open rental transaction to refund/void
    const t = await db.transaction.findFirstOrThrow({ where: { storeId, type: "RENTAL", rentals: { some: { returnedAt: null } }, customerId: { not: null } } });
    customerId = t.customerId!;
    await db.customer.update({ where: { id: customerId }, data: { outstandingFees: "6.00" } });
    await db.transaction.create({ data: { storeId, number: 9000, type: "RETURN", customerId, subtotal: "0", tax: "0", total: "0", balanceChange: "6.00", notes: "TEST" } });
  });

  afterAll(async () => {
    await db.$transaction((tx) => clearStoreData(tx, storeId));
    await db.storeMember.deleteMany({ where: { storeId } });
    await db.rentalCategory.deleteMany({ where: { storeId } });
    await db.storeFormat.deleteMany({ where: { storeId } });
    await db.storeSettings.deleteMany({ where: { storeId } });
    await db.store.delete({ where: { id: storeId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("sells credit (cash with change), rejects bad amounts and credit-for-credit", async () => {
    const r = await db.$transaction((tx) => sellCredit(tx, { storeId, userId, customerId, amountRaw: "50", method: "CASH", tenderedRaw: "60" }));
    expect(r.cents).toBe(5000);
    expect(await credit()).toBe(5000);
    const t = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId } });
    expect([t.type, toCents(t.creditChange), toCents(t.tendered!)]).toEqual(["STORE_CREDIT_SALE", 5000, 6000]);
    await fails(db.$transaction((tx) => sellCredit(tx, { storeId, userId, customerId, amountRaw: "0", method: "CASH" })));
    await fails(db.$transaction((tx) => sellCredit(tx, { storeId, userId, customerId, amountRaw: "500.01", method: "CASH" })));
    await fails(db.$transaction((tx) => sellCredit(tx, { storeId, userId, customerId, amountRaw: "5", method: "STORE_CREDIT" })));
    await fails(db.$transaction((tx) => sellCredit(tx, { storeId, userId, customerId, amountRaw: "x", method: "CASH" })));
  });

  it("spends credit only when enough, never negative, never for walk-ins", async () => {
    await fails(db.$transaction((tx) => spendCredit(tx, { storeId, customerId, cents: 5001 })));
    await fails(db.$transaction((tx) => spendCredit(tx, { storeId, customerId: null, cents: 100 })));
    await fails(db.$transaction((tx) => spendCredit(tx, { storeId: "other-store", customerId, cents: 100 })));
    expect(await credit()).toBe(5000);
  });

  it("pays an account balance with credit", async () => {
    const r = await db.$transaction((tx) => payBalance(tx, { storeId, userId, customerId, amountRaw: "2.50", method: "STORE_CREDIT" }));
    expect(r.cents).toBe(250);
    expect(await credit()).toBe(4750);
    const t = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId } });
    expect(toCents(t.creditChange)).toBe(-250);
  });

  it("refunds to credit (customer only) and voiding a credit-paid sale gives the credit back", async () => {
    const t = await db.transaction.findFirstOrThrow({ where: { storeId, type: "RENTAL", customerId, voidedAt: null, rentals: { some: { returnedAt: null, refundedAt: null } } }, include: { rentals: true } });
    const before = await credit();
    const r = await db.$transaction((tx) => refundTransaction(tx, { storeId, userId, transactionId: t.id, request: refundReq({ rentalIds: [t.rentals.find((x) => !x.returnedAt && !x.refundedAt)!.id] }) }));
    expect(await credit()).toBe(before + r.totalCents);
    const rt = await db.transaction.findUniqueOrThrow({ where: { id: r.refundId } });
    expect([toCents(rt.creditChange), rt.paymentMethod]).toEqual([r.totalCents, "STORE_CREDIT"]);

    // walk-in sale cannot be refunded to credit
    const walkIn = await db.transaction.findFirstOrThrow({ where: { storeId, type: "RETAIL_SALE", customerId: null, voidedAt: null }, include: { items: true } });
    await fails(db.$transaction((tx) => refundTransaction(tx, { storeId, userId, transactionId: walkIn.id, request: refundReq({ merchandise: [{ itemId: walkIn.items[0].id, qty: 1, restock: false }] }) })));

    // simulate a rental paid with credit, then void it
    const t2 = await db.transaction.findFirstOrThrow({ where: { storeId, type: "RENTAL", customerId: { not: customerId }, voidedAt: null, rentals: { every: { returnedAt: null } }, refunds: { none: {} } } });
    await db.customer.update({ where: { id: t2.customerId! }, data: { storeCredit: "20.00" } });
    const paid = toCents(t2.total);
    await db.customer.update({ where: { id: t2.customerId! }, data: { storeCredit: { decrement: (paid / 100).toFixed(2) } } });
    await db.transaction.update({ where: { id: t2.id }, data: { paymentMethod: "STORE_CREDIT", creditChange: (-paid / 100).toFixed(2) } });
    const c2 = await db.customer.findUniqueOrThrow({ where: { id: t2.customerId! } });
    await db.$transaction((tx) => voidTransaction(tx, { storeId, userId, transactionId: t2.id, reason: "TEST" }));
    const c2After = await db.customer.findUniqueOrThrow({ where: { id: t2.customerId! } });
    expect(toCents(c2After.storeCredit)).toBe(toCents(c2.storeCredit) + paid);
  });

  it("keeps Customer.storeCredit equal to the sum of creditChange", async () => {
    expect(await ledger()).toBe(await credit());
  });
});

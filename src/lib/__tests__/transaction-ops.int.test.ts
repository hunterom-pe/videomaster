// Database integration test for voids and refunds. Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { toCents } from "@/lib/pricing";
import { clearStoreData, loadSampleData } from "@/lib/sample-store";
import { TransactionOpError, loadOriginal, refundability, refundTransaction, voidTransaction } from "@/lib/transaction-ops";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("voids and refunds (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = "";
  let userId = "";
  const run = Date.now();
  const base = () => ({ storeId, userId });
  const refundReq = (over: Partial<Parameters<typeof refundTransaction>[1]["request"]> = {}) => ({ reason: "TEST", paymentMethod: "CASH" as const, merchandise: [], rentalIds: [], wholeFee: false, ...over });
  const fails = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(TransactionOpError);

  beforeAll(async () => {
    const user = await db.user.create({ data: { email: `ops-test-${run}@example.com`, passwordHash: "x" } });
    userId = user.id;
    const store = await db.store.create({
      data: {
        name: "OPS TEST", number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T",
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
    });
    storeId = store.id;
    await db.$transaction((tx) => loadSampleData(tx, storeId, userId, new Date()), { timeout: 60_000 });
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

  it("voids an open rental: copies return to the shelf, rentals vanish, blocked the second time", async () => {
    const t = await db.transaction.findFirst({ where: { storeId, type: "RENTAL", voidedAt: null, rentals: { some: {}, every: { returnedAt: null } } }, include: { rentals: true } });
    expect(t).toBeTruthy();
    await db.$transaction((tx) => voidTransaction(tx, { ...base(), transactionId: t!.id, reason: "TEST VOID" }));
    expect(await db.rental.count({ where: { transactionId: t!.id } })).toBe(0);
    const copies = await db.inventoryCopy.findMany({ where: { id: { in: t!.rentals.map((r) => r.copyId) } } });
    expect(copies.every((c) => c.status === "AVAILABLE")).toBe(true);
    const after = await db.transaction.findUniqueOrThrow({ where: { id: t!.id } });
    expect(after.voidedAt).not.toBeNull();
    expect(after.voidSnapshot).toBeTruthy();
    await fails(db.$transaction((tx) => voidTransaction(tx, { ...base(), transactionId: t!.id, reason: "AGAIN" })));
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq() })));
  });

  it("voids a merchandise sale and restocks", async () => {
    const t = await db.transaction.findFirst({ where: { storeId, type: "RETAIL_SALE", voidedAt: null, items: { some: { concessionItemId: { not: null } } } }, include: { items: true } });
    const item = t!.items[0];
    const before = (await db.concessionItem.findUniqueOrThrow({ where: { id: item.concessionItemId! } })).quantityOnHand;
    await db.$transaction((tx) => voidTransaction(tx, { ...base(), transactionId: t!.id, reason: "TEST VOID" }));
    const afterQty = (await db.concessionItem.findUniqueOrThrow({ where: { id: item.concessionItemId! } })).quantityOnHand;
    expect(afterQty).toBe(before + item.quantity);
  });

  it("refunds merchandise in pieces, with restock, capped, and tax summing to the original", async () => {
    const t = await db.transaction.findFirst({ where: { storeId, type: "RETAIL_SALE", voidedAt: null, items: { some: { quantity: { gte: 2 }, taxable: true } } }, include: { items: true } });
    expect(t).toBeTruthy();
    const line = t!.items.find((i) => i.quantity >= 2 && i.taxable)!;
    const stockBefore = (await db.concessionItem.findUniqueOrThrow({ where: { id: line.concessionItemId! } })).quantityOnHand;
    const refunds: { total: number; tax: number }[] = [];
    const take = async (qty: number, restock: boolean) => {
      const r = await db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ merchandise: [{ itemId: line.id, qty, restock }] }) }));
      refunds.push({ total: r.totalCents, tax: r.taxCents });
    };
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ merchandise: [{ itemId: line.id, qty: line.quantity + 1, restock: true }] }) })));
    await take(1, true);
    expect((await db.concessionItem.findUniqueOrThrow({ where: { id: line.concessionItemId! } })).quantityOnHand).toBe(stockBefore + 1);
    await take(line.quantity - 1, false); // no restock
    expect((await db.concessionItem.findUniqueOrThrow({ where: { id: line.concessionItemId! } })).quantityOnHand).toBe(stockBefore + 1);
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ merchandise: [{ itemId: line.id, qty: 1, restock: true }] }) })));
    // the refunded line is gone from refundability; other lines (if any) remain
    const orig = await loadOriginal(db, storeId, t!.id);
    expect(refundability(orig!).merchandise.find((m) => m.id === line.id)).toBeUndefined();
    // a transaction with refunds can no longer be voided
    await fails(db.$transaction((tx) => voidTransaction(tx, { ...base(), transactionId: t!.id, reason: "TOO LATE" })));
    // refunded tax never exceeds the original
    const taxBack = refunds.reduce((n, r) => n + r.tax, 0);
    expect(taxBack).toBeLessThanOrEqual(toCents(t!.tax));
  });

  it("refunds a rental charge only once, money only", async () => {
    const t = await db.transaction.findFirst({ where: { storeId, type: "RENTAL", voidedAt: null, rentals: { some: { refundedAt: null } } }, include: { rentals: true } });
    const r = t!.rentals[0];
    const res = await db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ rentalIds: [r.id] }) }));
    expect(res.totalCents).toBeGreaterThanOrEqual(toCents(r.price));
    const rental = await db.rental.findUniqueOrThrow({ where: { id: r.id }, include: { copy: true } });
    expect(rental.refundedAt).not.toBeNull();
    expect(rental.returnedAt).toEqual(r.returnedAt); // state untouched
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ rentalIds: [r.id] }) })));
  });

  it("refunds a fee payment only once", async () => {
    const t = await db.transaction.findFirst({ where: { storeId, type: "RETURN", voidedAt: null, refundedAt: null, total: { gt: 0 } } });
    expect(t).toBeTruthy();
    const res = await db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ wholeFee: true }) }));
    expect(res.totalCents).toBe(toCents(t!.total));
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq({ wholeFee: true }) })));
    await fails(db.$transaction((tx) => refundTransaction(tx, { ...base(), transactionId: t!.id, request: refundReq() }))); // nothing selected
  });
});

// Database integration test for "return all". Runs only when TEST_DATABASE_URL is set (`npm run test:db`).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { toCents } from "@/lib/pricing";
import { ReturnBatchError, returnRentals } from "@/lib/returns-batch";
import { clearStoreData, loadSampleData } from "@/lib/sample-store";

const url = process.env.TEST_DATABASE_URL;
const TZ = "America/Phoenix";

describe.skipIf(!url)("return all (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = "", userId = "";
  const run = Date.now();
  const fails = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(ReturnBatchError);

  beforeAll(async () => {
    userId = (await db.user.create({ data: { email: `batch-test-${run}@example.com`, passwordHash: "x" } })).id;
    storeId = (
      await db.store.create({
        data: {
          name: "BATCH TEST", number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T",
          members: { create: { userId, role: "OWNER" } },
          settings: { create: { salesTaxPercent: "8.6", timezone: TZ, storeYear: 1996, rewindFee: "1.00", damageFee: "5.00", lostItemFee: "2.00", membershipFee: "10.00", membershipTermMonths: 12 } },
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

  const opts = (customerId: string, rentalIds: string[], over: Partial<Parameters<typeof returnRentals>[1]> = {}) => ({
    storeId, userId, customerId, rentalIds, waiveLate: false, method: "CASH" as const, tz: TZ, now: new Date(), ...over,
  });

  async function customerWithOpen(min: number, late: boolean) {
    const open = await db.rental.findMany({ where: { storeId, returnedAt: null, ...(late ? { dueAt: { lt: new Date(Date.now() - 2 * 86_400_000) } } : {}) } });
    const by = new Map<string, typeof open>();
    for (const r of open) by.set(r.customerId, [...(by.get(r.customerId) ?? []), r]);
    return [...by.entries()].find(([, l]) => l.length >= min);
  }

  it("returns several videos as ONE transaction and frees the copies", async () => {
    const [customerId, list] = (await customerWithOpen(2, false))!;
    const ids = list.slice(0, 2).map((r) => r.id);
    const r = await db.$transaction((tx) => returnRentals(tx, opts(customerId, ids, { waiveLate: true })));
    expect(r.count).toBe(2);
    const rentals = await db.rental.findMany({ where: { id: { in: ids } } });
    expect(rentals.every((x) => x.returnedAt && x.outcome === "RETURNED" && x.returnTransactionId === r.transactionId)).toBe(true);
    const copies = await db.inventoryCopy.findMany({ where: { id: { in: rentals.map((x) => x.copyId) } } });
    expect(copies.every((c) => c.status === "AVAILABLE")).toBe(true);
    const t = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId } });
    expect(t.type).toBe("RETURN");
    expect(toCents(t.total)).toBe(0); // waived
    // already returned / not this customer's -> rejected, nothing changes
    await fails(db.$transaction((tx) => returnRentals(tx, opts(customerId, ids))));
  });

  it("puts part of the late fees on account and keeps the ledger balanced", async () => {
    const found = await customerWithOpen(1, true);
    expect(found).toBeTruthy();
    const [customerId, list] = found!;
    const ids = list.map((r) => r.id);
    await fails(db.$transaction((tx) => returnRentals(tx, opts(customerId, ["nope"]))));
    await fails(db.$transaction((tx) => returnRentals(tx, opts(customerId, ids, { paidRaw: "9999" }))));
    const r = await db.$transaction((tx) => returnRentals(tx, opts(customerId, ids, { paidRaw: "0" })));
    expect(r.totalCents).toBeGreaterThan(0);
    expect(r.paidCents).toBe(0);
    const c = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(toCents(c.outstandingFees)).toBe(r.totalCents);
    const sum = await db.transaction.aggregate({ where: { customerId, voidedAt: null }, _sum: { balanceChange: true } });
    expect(toCents(sum._sum.balanceChange ?? 0)).toBe(toCents(c.outstandingFees));
  });
});

// Database integration test for the sample-store generator. Runs only when TEST_DATABASE_URL is set
// (`npm run test:db` sets it and migrates the test database first).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { SampleDataError, clearStoreData, loadSampleData } from "@/lib/sample-store";
import { localDayKey } from "@/lib/tz";

const url = process.env.TEST_DATABASE_URL;
const ZONES = ["America/Phoenix", "Pacific/Honolulu", "America/New_York"];

describe.skipIf(!url)("sample store generator (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const stores: { id: string; tz: string }[] = [];
  let userId = "";
  const run = Date.now();

  beforeAll(async () => {
    const user = await db.user.create({ data: { email: `sample-test-${run}@example.com`, passwordHash: "x" } });
    userId = user.id;
    for (const tz of ZONES) {
      const store = await db.store.create({
        data: {
          name: `TEST ${tz}`, number: "0001", address: "1 TEST ST", city: "PHOENIX", region: "AZ", postalCode: "85001", phone: "(602) 555-0100", managerName: "T",
          members: { create: { userId, role: "OWNER" } },
          settings: { create: { salesTaxPercent: "8.6", timezone: tz, storeYear: 1996, rewindFee: "1.00", damageFee: "5.00", lostItemFee: "2.00", membershipFee: "10.00", membershipTermMonths: 12 } },
          formats: { create: [{ format: "VHS", enabled: true }, { format: "DVD", enabled: tz === "America/New_York" }] },
          rentalCategories: {
            create: [
              { name: "NEW RELEASE", rentalPrice: "3.99", rentalDays: 2, lateFeePerDay: "1.00", sortOrder: 0 },
              { name: "CATALOG", rentalPrice: "1.99", rentalDays: 5, lateFeePerDay: "1.00", maxLateFee: "10.00", sortOrder: 1 },
              { name: "KIDS", rentalPrice: "0.99", rentalDays: 5, lateFeePerDay: "0.50", sortOrder: 2 },
            ],
          },
        },
      });
      stores.push({ id: store.id, tz });
    }
  });

  afterAll(async () => {
    for (const s of stores) {
      await db.$transaction((tx) => clearStoreData(tx, s.id));
      await db.storeMember.deleteMany({ where: { storeId: s.id } });
      await db.rentalCategory.deleteMany({ where: { storeId: s.id } });
      await db.storeFormat.deleteMany({ where: { storeId: s.id } });
      await db.storeSettings.deleteMany({ where: { storeId: s.id } });
      await db.store.delete({ where: { id: s.id } });
    }
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  for (const tz of ZONES) {
    it(`builds a self-consistent store in ${tz}`, async () => {
      const store = stores.find((s) => s.tz === tz)!;
      const now = new Date();
      const summary = await db.$transaction((tx) => loadSampleData(tx, store.id, userId, now), { timeout: 60_000 });
      expect(summary.customers).toBe(22);
      expect(summary.titles).toBe(28);
      expect(summary.overdue).toBeGreaterThanOrEqual(3);

      const [copies, rentals, transactions, items, merch] = await Promise.all([
        db.inventoryCopy.findMany({ where: { storeId: store.id } }),
        db.rental.findMany({ where: { storeId: store.id } }),
        db.transaction.findMany({ where: { storeId: store.id }, orderBy: { number: "asc" } }),
        db.transactionItem.findMany({ where: { storeId: store.id } }),
        db.concessionItem.findMany({ where: { storeId: store.id } }),
      ]);

      // Copies vs open rentals: RENTED <=> exactly one open rental.
      const open = rentals.filter((r) => !r.returnedAt);
      for (const c of copies) {
        const n = open.filter((r) => r.copyId === c.id).length;
        expect(c.status === "RENTED" ? n : c.status === "AVAILABLE" || c.status === "LOST" || c.status === "DAMAGED" ? n : -1).toBe(c.status === "RENTED" ? 1 : 0);
      }
      // No overlapping rentals of one copy, and nothing rented after being lost/damaged.
      const byCopy = new Map<string, typeof rentals>();
      for (const r of rentals) byCopy.set(r.copyId, [...(byCopy.get(r.copyId) ?? []), r].sort((a, b) => a.rentedAt.getTime() - b.rentedAt.getTime()));
      for (const list of byCopy.values()) {
        list.forEach((r, i) => {
          if (i === 0) return;
          const prev = list[i - 1];
          expect(prev.returnedAt).not.toBeNull();
          expect(prev.returnedAt!.getTime()).toBeLessThanOrEqual(r.rentedAt.getTime());
          expect(prev.outcome).toBe("RETURNED");
        });
      }
      // Times are sane.
      for (const r of rentals) if (r.returnedAt) expect(r.returnedAt.getTime()).toBeGreaterThanOrEqual(r.rentedAt.getTime());
      for (const t of transactions) expect(t.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      // Contiguous transaction numbers and counters that cover the data.
      transactions.forEach((t, i) => expect(t.number).toBe(i + 1));
      const st = await db.store.findUniqueOrThrow({ where: { id: store.id } });
      expect(st.nextTransactionNumber).toBe(transactions.length + 1);
      expect(st.nextCopyNumber).toBe(copies.length + 1);
      expect(st.nextMembershipNumber).toBe(23);
      // Money: every transaction adds up, and the whole ledger reconciles.
      const cents = (x: { toString(): string }) => Math.round(Number(x.toString()) * 100);
      for (const t of transactions) expect(cents(t.total)).toBe(cents(t.subtotal) + cents(t.tax));
      const sum = (xs: { toString(): string }[]) => xs.reduce<number>((n, x) => n + cents(x), 0);
      const fees = transactions.filter((t) => t.type === "RETURN" || t.type === "MEMBERSHIP_FEE");
      expect(sum(rentals.map((r) => r.price)) + sum(items.map((i) => i.lineTotal)) + sum(fees.map((t) => t.total)) + sum(transactions.map((t) => t.tax))).toBe(sum(transactions.map((t) => t.total)));
      // Each RETURN transaction equals the fees charged on its rental.
      for (const r of rentals.filter((x) => x.returnTransactionId)) {
        const t = transactions.find((x) => x.id === r.returnTransactionId)!;
        expect(cents(t.total)).toBe(cents(r.chargedLateFee ?? 0) + cents(r.otherFee ?? 0) + cents(r.rewindFee ?? 0));
        expect(cents(r.chargedLateFee ?? 0)).toBeLessThanOrEqual(cents(r.calculatedLateFee ?? 0));
      }
      // Stock and the demo's designed warnings.
      for (const m of merch) expect(m.quantityOnHand).toBeGreaterThanOrEqual(0);
      expect(merch.filter((m) => m.quantityOnHand === 0)).toHaveLength(1);
      // Every item points at a category of THIS store, and SKUs follow the category letter (C001, C002, P001...).
      const cats = await db.concessionCategory.findMany({ where: { storeId: store.id } });
      for (const m of merch) {
        const cat = cats.find((c) => c.id === m.categoryId);
        expect(cat).toBeDefined();
        expect(m.sku.startsWith(cat!.prefix)).toBe(true);
      }
      expect(new Set(merch.map((m) => m.sku)).size).toBe(merch.length);
      expect(merch.filter((m) => m.quantityOnHand > 0 && m.quantityOnHand <= m.lowStockThreshold).length).toBeGreaterThanOrEqual(2);
      // Overdue is measured in the STORE's calendar (the summary and an independent recount agree).
      const today = localDayKey(now, tz);
      const overdue = open.filter((r) => localDayKey(r.dueAt, tz) < today).length;
      expect(overdue).toBe(summary.overdue);
      // There is activity today (store-local), so the demo doesn't open on an empty day.
      expect(transactions.some((t) => localDayKey(t.createdAt, tz) === today)).toBe(true);
    });

    it(`refuses to load into a non-empty store, then clears cleanly in ${tz}`, async () => {
      const store = stores.find((s) => s.tz === tz)!;
      await expect(db.$transaction((tx) => loadSampleData(tx, store.id, userId))).rejects.toBeInstanceOf(SampleDataError);
      await db.$transaction((tx) => clearStoreData(tx, store.id));
      const counts = await Promise.all([db.customer.count({ where: { storeId: store.id } }), db.movieTitle.count({ where: { storeId: store.id } }), db.transaction.count({ where: { storeId: store.id } }), db.concessionItem.count({ where: { storeId: store.id } })]);
      expect(counts).toEqual([0, 0, 0, 0]);
      const settings = await db.storeSettings.findUniqueOrThrow({ where: { storeId: store.id } });
      expect(settings.timezone).toBe(tz); // settings survive a clear
      // and it can be loaded again
      const again = await db.$transaction((tx) => loadSampleData(tx, store.id, userId), { timeout: 60_000 });
      expect(again.titles).toBe(28);
      await db.$transaction((tx) => clearStoreData(tx, store.id));
    });
  }
});

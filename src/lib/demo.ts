import "server-only";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { loadSampleData } from "@/lib/sample-store";
import { categoryFields, concessionCategoryFields, formatRows, settingsFields, storeFields } from "@/lib/store-fields";
import { EMPTY_STORE } from "@/lib/form-defaults";
import { storeSchema } from "@/lib/validation";

// Demo mode: every click creates a private, throwaway account + fully stocked store, so visitors never see each
// other's changes and nothing needs resetting. Old demo accounts are purged opportunistically.

export const DEMO_TTL_HOURS = 24;
export const DEMO_EMAIL_DOMAIN = "demo.videomaster.invalid"; // reserved TLD: can never be a real address

const DEMO_STORE = {
  ...EMPTY_STORE,
  name: "DEMO VIDEO", number: "0001", address: "123 MAIN STREET", city: "PHOENIX", region: "AZ", postalCode: "85001",
  phone: "(602) 555-0100", managerName: "DEMO MANAGER", slogan: "BE KIND, REWIND", salesTaxPercent: "8.6", storeYear: "1996",
  onlyMoviesUpToStoreYear: true, rewindFee: "1.00", damageFee: "5.00", lostItemFee: "2.00", membershipFee: "10.00",
  membershipTermMonths: "12", maxRentalsOut: "8", formats: ["VHS"], receiptFooter: "THANKS FOR TRYING THE DEMO!",
};

/** Delete demo accounts (and their stores) older than the TTL. */
export async function purgeOldDemos(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - DEMO_TTL_HOURS * 3_600_000);
  const old = await db.user.findMany({ where: { isDemo: true, createdAt: { lt: cutoff } }, select: { id: true, memberships: { select: { storeId: true } } }, take: 50 });
  if (old.length === 0) return 0;
  const storeIds = old.flatMap((u) => u.memberships.map((m) => m.storeId));
  await db.store.deleteMany({ where: { id: { in: storeIds } } });
  await db.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });
  return old.length;
}

/** Create a fresh demo user and a fully populated store. Returns the new user's id. */
export async function createDemoAccount(db: PrismaClient, now = new Date()): Promise<string> {
  const d = storeSchema.parse(DEMO_STORE);
  return db.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        // "!" is not a valid password hash, so nobody can ever log on to a demo account with a password.
        data: { email: `demo-${randomBytes(8).toString("hex")}@${DEMO_EMAIL_DOMAIN}`, passwordHash: "!", isDemo: true },
      });
      const store = await tx.store.create({
        data: {
          ...storeFields(d),
          members: { create: { userId: user.id, role: "OWNER" } },
          settings: { create: settingsFields(d) },
          formats: { create: formatRows(d) },
          rentalCategories: { create: d.categories.map((c, i) => categoryFields(c, i)) },
          concessionCategories: { create: d.concessionCategories.map((c, i) => concessionCategoryFields(c, i)) },
        },
      });
      await loadSampleData(tx, store.id, user.id, now);
      return user.id;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

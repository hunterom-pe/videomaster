import "server-only";
import { randomUUID } from "node:crypto";
import type { CopyStatus, MediaFormat, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { daysLate, lateFeeCents } from "@/lib/late-fees";
import { addMonths } from "@/lib/membership";
import { computeTotals, dueDate, fromCents, toCents } from "@/lib/pricing";
import samples from "@/lib/sample-titles.json";
import { buildSearchText, FORMAT_CODES } from "@/lib/inventory-shared";
import { addDaysToKey, localDayKey, zonedMidnight } from "@/lib/tz";

// A self-consistent demo store: real 1990s movie metadata (fetched once from TMDB and saved in sample-titles.json),
// fictional customers and merchandise, and ~3 weeks of rentals/returns/sales history with late fees and overdue videos.
// Only ever loaded into an EMPTY store, in one transaction.

type Tx = Prisma.TransactionClient;
export class SampleDataError extends Error {}

export const SAMPLE_HISTORY_DAYS = 21;

// ── deterministic randomness (same store settings => same demo) ──
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Dana", "Marcus", "Priya", "Tom", "Luisa", "Devon", "Hannah", "Omar", "Grace", "Victor", "Nina", "Caleb", "Rosa", "Ethan", "Mei", "Andre", "Tessa", "Jorge", "Amber", "Louis", "Yuki", "Frank", "Bianca", "Sam"];
const LAST = ["Alvarez", "Brooks", "Chandra", "Doyle", "Espinoza", "Fitch", "Gallagher", "Hassan", "Ito", "Jensen", "Kowalski", "Lindqvist", "Moreno", "Nakamura", "Okafor", "Petrov", "Quinn", "Rivera", "Sato", "Thibodeaux", "Underhill", "Vasquez", "Whitaker", "Yoder"];
const STREETS = ["Maple Ave", "Oak Street", "Cedar Lane", "Sunset Blvd", "Pine Court", "Desert Rose Dr", "Mesa Drive", "Palm Way", "Juniper Rd", "Canyon View"];

const MERCH = [
  { name: "M&M PEANUT", category: "CANDY", price: 1.49, qty: 18 },
  { name: "TWIZZLERS", category: "CANDY", price: 1.29, qty: 11 },
  { name: "SOUR PATCH KIDS", category: "CANDY", price: 1.49, qty: 4 }, // low stock
  { name: "CHOCOLATE BAR", category: "CANDY", price: 0.99, qty: 24 },
  { name: "JUJUBES", category: "CANDY", price: 1.19, qty: 0 }, // out of stock
  { name: "MICROWAVE POPCORN", category: "POPCORN", price: 2.49, qty: 15 },
  { name: "LARGE POPCORN", category: "POPCORN", price: 2.49, qty: 40 },
  { name: "SMALL POPCORN", category: "POPCORN", price: 1.49, qty: 40 },
  { name: "COKE 20OZ", category: "DRINKS", price: 1.79, qty: 9 },
  { name: "ORANGE SODA 20OZ", category: "DRINKS", price: 1.79, qty: 12 },
  { name: "BOTTLED WATER", category: "DRINKS", price: 1.25, qty: 30 },
  { name: "POTATO CHIPS", category: "SNACKS", price: 1.29, qty: 14 },
  { name: "PRETZELS", category: "SNACKS", price: 1.19, qty: 3 }, // low stock
  { name: "HEAD CLEANING TAPE", category: "ACCESSORIES", price: 7.99, qty: 6 },
  { name: "BLANK VHS TAPE", category: "ACCESSORIES", price: 2.99, qty: 20 },
  { name: "VHS REWINDER", category: "ACCESSORIES", price: 19.99, qty: 2 }, // at threshold => low stock
] as const;
const PREFIX: Record<string, string> = { CANDY: "C", POPCORN: "P", DRINKS: "D", SNACKS: "S", ACCESSORIES: "A", OTHER: "O" };
const MERCH_CATEGORY_NAME: Record<string, string> = { CANDY: "CANDY", POPCORN: "POPCORN", DRINKS: "DRINKS", SNACKS: "SNACKS", ACCESSORIES: "VIDEO ACCESSORIES", OTHER: "OTHER" };
const KIDS = new Set(["Toy Story", "Aladdin", "The Lion King", "Beauty and the Beast", "Home Alone"]);

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const HOUR = 3_600_000;

type Cat = { id: string; name: string; rentalPrice: { toString(): string }; rentalDays: number; lateFeePerDay: { toString(): string }; maxLateFee: { toString(): string } | null; taxable: boolean };

export async function sampleDataBlocker(tx: Tx, storeId: string): Promise<string | null> {
  const [customers, titles, items, transactions] = await Promise.all([
    tx.customer.count({ where: { storeId } }),
    tx.movieTitle.count({ where: { storeId } }),
    tx.concessionItem.count({ where: { storeId } }),
    tx.transaction.count({ where: { storeId } }),
  ]);
  return customers + titles + items + transactions > 0
    ? "SAMPLE DATA CAN ONLY BE LOADED INTO A STORE WITH NO CUSTOMERS, TITLES, MERCHANDISE OR TRANSACTIONS."
    : null;
}

export async function loadSampleData(tx: Tx, storeId: string, actorUserId: string, now = new Date()) {
  const blocker = await sampleDataBlocker(tx, storeId);
  if (blocker) throw new SampleDataError(blocker);

  const store = await tx.store.findUniqueOrThrow({
    where: { id: storeId },
    include: { settings: true, formats: true, rentalCategories: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  const settings = store.settings!;
  const tz = settings.timezone;
  const categories = store.rentalCategories as Cat[];
  if (categories.length === 0) throw new SampleDataError("THE STORE HAS NO RENTAL CATEGORIES. ADD ONE IN STORE SETTINGS FIRST.");
  const byName = (n: string) => categories.find((c) => c.name.toUpperCase() === n);
  const catNew = byName("NEW RELEASE") ?? categories[0];
  const catCatalog = byName("CATALOG") ?? categories[Math.min(1, categories.length - 1)];
  const catKids = byName("KIDS") ?? catCatalog;
  const rnd = mulberry32(1996);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];

  // The demo is a VHS store; make sure VHS is carried (other formats the owner enabled get a few extra copies).
  await tx.storeFormat.upsert({ where: { storeId_format: { storeId, format: "VHS" } }, update: { enabled: true }, create: { storeId, format: "VHS", enabled: true } });
  const hasDvd = store.formats.some((f) => f.enabled && f.format === "DVD");

  // ── customers ──
  const areaCode = (store.phone.match(/\(?(\d{3})\)?/)?.[1]) ?? "555";
  const term = settings.membershipTermMonths;
  const customers = Array.from({ length: 22 }, (_, i) => {
    const first = FIRST[i], last = LAST[(i * 7 + 3) % LAST.length];
    const joined = new Date(now.getTime() - (20 + Math.floor(rnd() * 600)) * 24 * HOUR);
    const paidAt = term > 0 ? new Date(now.getTime() - (10 + Math.floor(rnd() * 25)) * 24 * HOUR) : null; // paid before the history window
    let expires: Date | null = paidAt ? addMonths(paidAt, term) : null;
    if (term > 0 && i === 5) expires = new Date(now.getTime() - 12 * 24 * HOUR); // one lapsed membership to demo the warning
    const phone = `(${areaCode}) 555-01${pad(10 + i * 3, 2)}`;
    return {
      id: randomUUID(), storeId, membershipNumber: pad(store.nextMembershipNumber + i, 6), firstName: first, lastName: last,
      phone, phoneDigits: phone.replace(/\D/g, ""), email: i % 3 === 0 ? `${first}.${last}@example.com`.toLowerCase() : null,
      address: `${100 + ((i * 137) % 900)} ${STREETS[i % STREETS.length]}`, city: store.city, region: store.region, postalCode: store.postalCode,
      status: i === 11 ? ("SUSPENDED" as const) : ("GOOD" as const), notes: i === 11 ? "SAMPLE DATA: ACCOUNT SUSPENDED FOR UNRETURNED TAPES." : null,
      createdAt: joined, membershipPaidAt: paidAt, membershipExpiresAt: expires,
    };
  });
  const rentable = customers.filter((c) => c.status === "GOOD");

  // ── merchandise ──
  // Make sure the store has the merchandise categories the demo uses (reactivating or creating them as needed).
  const merchCategoryIds = new Map<string, { id: string; prefix: string }>();
  for (const key of new Set(MERCH.map((m) => m.category))) {
    const name = MERCH_CATEGORY_NAME[key];
    const existing = await tx.concessionCategory.findUnique({ where: { storeId_name: { storeId, name } } });
    const row = existing
      ? await tx.concessionCategory.update({ where: { id: existing.id, storeId }, data: { active: true } })
      : await tx.concessionCategory.create({ data: { storeId, name, prefix: PREFIX[key], sortOrder: 50 } });
    merchCategoryIds.set(key, { id: row.id, prefix: row.prefix });
  }
  const counters: Record<string, number> = {};
  const demoCategoryOf = new Map<string, string>(); // merchandise id -> demo category key (for sales weighting)
  const merch = MERCH.map((m) => {
    const cat = merchCategoryIds.get(m.category)!;
    counters[cat.prefix] = (counters[cat.prefix] ?? 0) + 1;
    const id = randomUUID();
    demoCategoryOf.set(id, m.category);
    return {
      id, storeId, sku: `${cat.prefix}${pad(counters[cat.prefix], 3)}`, name: m.name, categoryId: cat.id,
      retailPrice: m.price.toFixed(2), costPrice: (m.price * 0.5).toFixed(2), taxable: true, quantityOnHand: m.qty,
      lowStockThreshold: m.name === "VHS REWINDER" ? 2 : 5, active: true, barcode: null as string | null,
    };
  });
  const sellable = merch.filter((m) => m.quantityOnHand > 0);
  // Snacks sell far more often than $20 accessories.
  const SALE_WEIGHT: Record<string, number> = { CANDY: 30, POPCORN: 30, DRINKS: 20, SNACKS: 15, ACCESSORIES: 1 };
  const saleWeightTotal = sellable.reduce((n, m) => n + (SALE_WEIGHT[demoCategoryOf.get(m.id)!] ?? 5), 0);
  const pickMerch = () => {
    let r = rnd() * saleWeightTotal;
    for (const m of sellable) if ((r -= SALE_WEIGHT[demoCategoryOf.get(m.id)!] ?? 5) <= 0) return m;
    return sellable[sellable.length - 1];
  };

  // ── titles and copies ──
  const storeYear = settings.storeYear ?? 1996;
  const titleRows = samples.map((t) => ({
    id: randomUUID(), storeId, title: t.title, year: t.year, tmdbId: t.tmdbId, overview: t.overview || null, posterPath: t.posterPath,
    director: t.director || null, runtimeMinutes: t.runtimeMinutes, genres: t.genres, cast: t.cast, rating: t.rating || null,
    searchText: buildSearchText(t.director, t.genres, t.cast),
  }));
  type CopyPlan = {
    id: string; titleIdx: number; format: MediaFormat; cat: Cat; number: string; condition: string; busyUntil: number; status: CopyStatus; notes: string | null;
  };
  const copies: CopyPlan[] = [];
  let copyCounter = store.nextCopyNumber;
  samples.forEach((t, titleIdx) => {
    const cat = KIDS.has(t.title) ? catKids : t.year >= storeYear - 1 ? catNew : catCatalog;
    const n = cat === catNew ? 4 + Math.floor(rnd() * 3) : cat === catKids ? 3 : 2 + Math.floor(rnd() * 2);
    const make = (format: MediaFormat, howMany: number) => {
      for (let k = 0; k < howMany; k++) {
        copies.push({
          id: randomUUID(), titleIdx, format, cat, number: `${FORMAT_CODES[format]}-${pad(copyCounter++, 6)}`,
          condition: pick(["GOOD", "GOOD", "GOOD", "EXCELLENT", "FAIR"]), busyUntil: 0, status: "AVAILABLE", notes: null,
        });
      }
    };
    make("VHS", n);
    if (hasDvd && titleIdx % 3 === 0) make("DVD", 1 + (titleIdx % 2));
  });
  const copiesByTitle = new Map<number, CopyPlan[]>();
  for (const c of copies) copiesByTitle.set(c.titleIdx, [...(copiesByTitle.get(c.titleIdx) ?? []), c]);
  // Popularity: recent titles rent more often.
  const weights = samples.map((t) => (t.year >= storeYear - 1 ? 5 : t.year >= storeYear - 4 ? 3 : 1.5));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const pickTitle = () => {
    let r = rnd() * weightSum;
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
    return weights.length - 1;
  };

  // ── history simulation ──
  const taxPercent = settings.salesTaxPercent.toString();
  const PAY: [PaymentMethod, number][] = [["CASH", 50], ["CREDIT_CARD", 25], ["DEBIT", 20], ["CHECK", 3], ["OTHER", 2]];
  const pickPay = (): PaymentMethod => {
    let r = rnd() * 100;
    for (const [m, w] of PAY) if ((r -= w) <= 0) return m;
    return "CASH";
  };
  const today = localDayKey(now, tz);
  const at = (dayKey: string, hour: number) => new Date(zonedMidnight(dayKey, tz).getTime() + hour * HOUR);
  const nowHour = (now.getTime() - zonedMidnight(today, tz).getTime()) / HOUR; // hours elapsed in the store-local day
  // Store hours are ~11am-9pm; on "today" only use hours that have already happened so today shows real activity.
  const openHour = (isToday = false) => (isToday ? 10 + rnd() * Math.max(0.5, nowHour - 10.5) : 11 + rnd() * 10);

  type RentalPlan = { id: string; copy: CopyPlan; customerId: string; txIdx: number; rentedAt: Date; dueAt: Date; price: number; returnedAt: Date | null; returnTxIdx: number | null; outcome: "RETURNED" | "DAMAGED" | "LOST" | null; fate: "RETURNED" | "DAMAGED" | "LOST"; calc: number; charged: number; other: number; rewind: number };
  type TxPlan = {
    id: string; at: Date; type: "RENTAL" | "RETURN" | "RETAIL_SALE"; customerId: string | null; pay: PaymentMethod; notes: string | null;
    rentalLines: { cents: number; taxable: boolean }[]; items: { merch: (typeof merch)[number]; qty: number }[]; feeCents: number;
  };
  const txs: TxPlan[] = [];
  const rentals: RentalPlan[] = [];
  const forcedOverdueDays = new Set([-8, -6, -4]);
  const forcedDone = new Set<number>();
  let returnedCreated = 0; // returned rentals created so far (drives the demo's one lost and few damaged tapes)

  for (let off = -SAMPLE_HISTORY_DAYS; off <= 0; off++) {
    const dayKey = addDaysToKey(today, off);
    const dow = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
    const nTx = off === 0 ? 3 : dow === 5 || dow === 6 ? 6 + Math.floor(rnd() * 4) : dow === 0 ? 3 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3);
    const hours = Array.from({ length: nTx }, () => openHour(off === 0)).sort((a, b) => a - b);
    for (const hour of hours) {
      const t = at(dayKey, hour);
      if (t > now) continue;
      const customer = pick(rentable);
      const want = rnd() < 0.55 ? 1 : rnd() < 0.78 ? 2 : 3;
      const chosen: CopyPlan[] = [];
      for (let tries = 0; tries < 12 && chosen.length < want; tries++) {
        const ti = pickTitle();
        if (chosen.some((c) => c.titleIdx === ti)) continue;
        const free = (copiesByTitle.get(ti) ?? []).find((c) => c.busyUntil <= t.getTime() && c.status === "AVAILABLE" && c.format === "VHS");
        if (free) chosen.push(free);
      }
      if (chosen.length === 0) continue;
      const txIdx = txs.length;
      const plan: TxPlan = {
        id: randomUUID(), at: t, type: "RENTAL", customerId: customer.id, pay: pickPay(), notes: null,
        rentalLines: chosen.map((c) => ({ cents: toCents(c.cat.rentalPrice), taxable: c.cat.taxable })), items: [], feeCents: 0,
      };
      if (rnd() < 0.42) {
        const lines = 1 + (rnd() < 0.35 ? 1 : 0);
        const seen = new Set<string>();
        for (let i = 0; i < lines; i++) {
          const m = pickMerch();
          if (!seen.has(m.id)) { seen.add(m.id); plan.items.push({ merch: m, qty: rnd() < 0.8 ? 1 : 2 }); }
        }
      }
      txs.push(plan);

      chosen.forEach((copy, i) => {
        const days = copy.cat.rentalDays;
        const due = dueDate(t, days);
        const forceOut = forcedOverdueDays.has(off) && !forcedDone.has(off) && i === 0;
        if (forceOut) forcedDone.add(off);
        // Return timing: mostly on time, some late, a few never (still out / overdue).
        const roll = rnd();
        let returnOffset: number | null;
        if (forceOut || roll > 0.97) returnOffset = null;
        else if (roll < 0.72) returnOffset = 1 + Math.floor(rnd() * days);
        else if (roll < 0.92) returnOffset = days + 1 + Math.floor(rnd() * 2);
        else returnOffset = days + 3 + Math.floor(rnd() * 4);
        let returnedAt: Date | null = null;
        if (returnOffset !== null) {
          const rd = at(addDaysToKey(dayKey, returnOffset), openHour());
          if (rd.getTime() <= now.getTime()) returnedAt = rd;
        }
        // A lost or damaged tape never goes back on the shelf, so decide that now (before later rentals pick copies).
        let fate: "RETURNED" | "DAMAGED" | "LOST" = "RETURNED";
        if (returnedAt) {
          returnedCreated++;
          if (returnedCreated === 9) fate = "LOST";
          else if (returnedCreated % 23 === 0) fate = "DAMAGED";
        }
        rentals.push({ id: randomUUID(), copy, customerId: customer.id, txIdx, rentedAt: t, dueAt: due, price: toCents(copy.cat.rentalPrice), returnedAt, returnTxIdx: null, outcome: null, fate, calc: 0, charged: 0, other: 0, rewind: 0 });
        copy.busyUntil = returnedAt && fate === "RETURNED" ? returnedAt.getTime() : Number.POSITIVE_INFINITY;
      });
    }
    // walk-in merchandise sales
    const walkIns = off === 0 ? 1 : 1 + Math.floor(rnd() * 3);
    for (let w = 0; w < walkIns; w++) {
      const t = at(dayKey, openHour(off === 0));
      if (t > now) continue;
      const m = pickMerch();
      txs.push({ id: randomUUID(), at: t, type: "RETAIL_SALE", customerId: null, pay: pickPay(), notes: null, rentalLines: [], items: [{ merch: m, qty: 1 + Math.floor(rnd() * 3) }], feeCents: 0 });
    }
  }

  // Returns become their own RETURN transactions (as in the real app), with fees per store policy.
  for (const r of rentals.filter((x) => x.returnedAt).sort((a, b) => a.returnedAt!.getTime() - b.returnedAt!.getTime())) {
    const at = r.returnedAt!;
    const cat = r.copy.cat;
    r.calc = lateFeeCents(daysLate(r.dueAt, at, tz), toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null);
    const lost = r.fate === "LOST";
    const damaged = r.fate === "DAMAGED";
    r.outcome = lost ? "LOST" : damaged ? "DAMAGED" : "RETURNED";
    if (lost) r.other = toCents(settings.replacementFee) + toCents(settings.lostItemFee);
    else if (damaged) r.other = toCents(settings.damageFee);
    const f = rnd();
    r.charged = lost ? 0 : r.calc === 0 ? 0 : f < 0.65 ? r.calc : f < 0.85 ? 0 : Math.round(r.calc / 2);
    if (r.outcome !== "LOST" && toCents(settings.rewindFee) > 0 && rnd() < 0.2) r.rewind = toCents(settings.rewindFee);
    r.copy.status = lost ? "LOST" : damaged ? "DAMAGED" : "AVAILABLE";
    if (lost || damaged) { r.copy.condition = "POOR"; r.copy.notes = lost ? "SAMPLE DATA: REPORTED LOST BY CUSTOMER." : "SAMPLE DATA: TAPE CHEWED BY VCR."; }
    const notes = [
      r.outcome !== "RETURNED" ? `COPY MARKED ${r.outcome}` : null,
      r.calc > 0 && r.charged !== r.calc && !lost ? `LATE FEE $${fromCents(r.calc)} CALCULATED, $${fromCents(r.charged)} CHARGED${r.charged === 0 ? " (WAIVED)" : " (REDUCED)"}` : null,
      lost && r.calc > 0 ? `LATE FEE $${fromCents(r.calc)} NOT CHARGED (LOST ITEM)` : null,
      r.rewind > 0 ? `REWIND FEE $${fromCents(r.rewind)}` : null,
    ].filter(Boolean).join("; ");
    r.returnTxIdx = txs.length;
    txs.push({ id: randomUUID(), at, type: "RETURN", customerId: r.customerId, pay: pickPay(), notes: notes || null, rentalLines: [], items: [], feeCents: r.charged + r.other + r.rewind });
  }
  for (const r of rentals) if (!r.returnedAt) r.copy.status = "RENTED";

  // Number transactions chronologically.
  const order = txs.map((_, i) => i).sort((a, b) => txs[a].at.getTime() - txs[b].at.getTime());
  const numberOf = new Map<number, number>();
  order.forEach((idx, n) => numberOf.set(idx, store.nextTransactionNumber + n));

  // ── persist (parents before children) ──
  const txRows = txs.map((t, idx) => {
    const totals = computeTotals(t.rentalLines, t.items.map((i) => ({ cents: toCents(i.merch.retailPrice) * i.qty, taxable: i.merch.taxable })), taxPercent);
    const isReturn = t.type === "RETURN";
    return {
      id: t.id, storeId, number: numberOf.get(idx)!, type: t.type, customerId: t.customerId, createdById: actorUserId,
      subtotal: fromCents(isReturn ? t.feeCents : totals.subtotal), tax: fromCents(isReturn ? 0 : totals.tax), total: fromCents(isReturn ? t.feeCents : totals.total),
      paymentMethod: t.pay, notes: t.notes, createdAt: t.at,
    };
  });

  await tx.customer.createMany({ data: customers });
  await tx.movieTitle.createMany({ data: titleRows });
  await tx.concessionItem.createMany({ data: merch });
  await tx.inventoryCopy.createMany({
    data: copies.map((c) => ({
      id: c.id, storeId, movieTitleId: titleRows[c.titleIdx].id, copyNumber: c.number, format: c.format, status: c.status, condition: c.condition,
      rentalCategoryId: c.cat.id, replacementCost: settings.replacementFee.toString(), notes: c.notes,
      acquiredAt: new Date(now.getTime() - (SAMPLE_HISTORY_DAYS + 30) * 24 * HOUR),
    })),
  });
  await tx.transaction.createMany({ data: txRows });
  await tx.rental.createMany({
    data: rentals.map((r) => ({
      id: r.id, storeId, customerId: r.customerId, copyId: r.copy.id, transactionId: txs[r.txIdx].id, price: fromCents(r.price),
      rentedAt: r.rentedAt, dueAt: r.dueAt, returnedAt: r.returnedAt, outcome: r.outcome,
      calculatedLateFee: r.returnedAt ? fromCents(r.calc) : null, chargedLateFee: r.returnedAt ? fromCents(r.charged) : null,
      otherFee: r.other > 0 ? fromCents(r.other) : null, rewindFee: r.rewind > 0 ? fromCents(r.rewind) : null,
      returnTransactionId: r.returnTxIdx !== null ? txs[r.returnTxIdx].id : null,
    })),
  });
  await tx.transactionItem.createMany({
    data: txs.flatMap((t) =>
      t.items.map((i) => ({
        storeId, transactionId: t.id, concessionItemId: i.merch.id, sku: i.merch.sku, description: i.merch.name, quantity: i.qty,
        unitPrice: i.merch.retailPrice, lineTotal: fromCents(toCents(i.merch.retailPrice) * i.qty), taxable: i.merch.taxable,
      })),
    ),
  });
  await tx.store.update({
    where: { id: storeId },
    data: {
      nextMembershipNumber: store.nextMembershipNumber + customers.length,
      nextCopyNumber: copyCounter,
      nextTransactionNumber: store.nextTransactionNumber + txs.length,
    },
  });

  return {
    customers: customers.length, titles: titleRows.length, copies: copies.length, merchandise: merch.length,
    transactions: txs.length, rentals: rentals.length,
    out: rentals.filter((r) => !r.returnedAt).length,
    overdue: rentals.filter((r) => !r.returnedAt && localDayKey(r.dueAt, tz) < today).length,
  };
}

/** Delete all operational data (customers, inventory, merchandise, rentals, transactions); keeps store settings. */
export async function clearStoreData(tx: Tx, storeId: string) {
  await tx.transactionItem.deleteMany({ where: { storeId } });
  await tx.rental.deleteMany({ where: { storeId } });
  await tx.transaction.deleteMany({ where: { storeId } });
  await tx.inventoryCopy.deleteMany({ where: { storeId } });
  await tx.movieTitle.deleteMany({ where: { storeId } });
  await tx.concessionItem.deleteMany({ where: { storeId } });
  await tx.customer.deleteMany({ where: { storeId } });
  await tx.store.update({ where: { id: storeId }, data: { nextMembershipNumber: 1, nextCopyNumber: 1, nextTransactionNumber: 1 } });
}

import "server-only";
import { db } from "@/lib/db";

// Data export for the store owner/manager: one CSV per table, or everything as one JSON file. Every query is scoped to
// the store resolved from the session. Capped so a runaway export can't exhaust memory (far above any real store).
const CAP = 200_000;

export type Table = { filename: string; headers: string[]; rows: (string | number | boolean | Date | null | { toString(): string })[][] };
export const EXPORT_KINDS = ["customers", "titles", "copies", "rentals", "transactions", "transaction-items", "merchandise"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export const EXPORT_LABELS: Record<ExportKind, string> = {
  customers: "CUSTOMERS", titles: "MOVIE TITLES", copies: "INVENTORY COPIES", rentals: "RENTALS", transactions: "TRANSACTIONS",
  "transaction-items": "TRANSACTION ITEMS (MERCHANDISE / FEES)", merchandise: "MERCHANDISE (CONCESSIONS)",
};

export async function exportTable(kind: ExportKind, storeId: string): Promise<Table> {
  switch (kind) {
    case "customers": {
      const r = await db.customer.findMany({ where: { storeId }, orderBy: { membershipNumber: "asc" }, take: CAP });
      return {
        filename: "customers",
        headers: ["member_number", "first_name", "last_name", "phone", "email", "address", "city", "state", "postal_code", "date_of_birth", "status", "membership_expires", "balance_due", "store_credit", "notes", "created"],
        rows: r.map((c) => [c.membershipNumber, c.firstName, c.lastName, c.phone, c.email, c.address, c.city, c.region, c.postalCode, c.dateOfBirth?.toISOString().slice(0, 10) ?? null, c.status, c.membershipExpiresAt, c.outstandingFees, c.storeCredit, c.notes, c.createdAt]),
      };
    }
    case "titles": {
      const r = await db.movieTitle.findMany({ where: { storeId }, orderBy: { title: "asc" }, take: CAP });
      return {
        filename: "titles",
        headers: ["title", "year", "rating", "runtime_minutes", "director", "genres", "cast", "tmdb_id", "overview"],
        rows: r.map((t) => [t.title, t.year, t.rating, t.runtimeMinutes, t.director, t.genres.join("; "), t.cast.join("; "), t.tmdbId, t.overview]),
      };
    }
    case "copies": {
      const r = await db.inventoryCopy.findMany({ where: { storeId }, orderBy: { copyNumber: "asc" }, take: CAP, include: { movieTitle: { select: { title: true, year: true } }, rentalCategory: { select: { name: true } } } });
      return {
        filename: "inventory-copies",
        headers: ["copy_number", "title", "year", "format", "status", "condition", "barcode", "rental_category", "replacement_cost", "acquired", "notes"],
        rows: r.map((c) => [c.copyNumber, c.movieTitle.title, c.movieTitle.year, c.format, c.status, c.condition, c.barcode, c.rentalCategory?.name ?? null, c.replacementCost, c.acquiredAt, c.notes]),
      };
    }
    case "rentals": {
      const r = await db.rental.findMany({
        where: { storeId }, orderBy: { rentedAt: "desc" }, take: CAP,
        include: { customer: { select: { membershipNumber: true, firstName: true, lastName: true } }, copy: { select: { copyNumber: true, movieTitle: { select: { title: true } } } }, transaction: { select: { number: true } } },
      });
      return {
        filename: "rentals",
        headers: ["member_number", "customer", "title", "copy_number", "rented", "due", "returned", "outcome", "price", "calculated_late_fee", "charged_late_fee", "other_fee", "rewind_fee", "refunded", "transaction_number"],
        rows: r.map((x) => [x.customer.membershipNumber, `${x.customer.firstName} ${x.customer.lastName}`, x.copy.movieTitle.title, x.copy.copyNumber, x.rentedAt, x.dueAt, x.returnedAt, x.outcome, x.price, x.calculatedLateFee, x.chargedLateFee, x.otherFee, x.rewindFee, x.refundedAt, x.transaction?.number ?? null]),
      };
    }
    case "transactions": {
      const r = await db.transaction.findMany({
        where: { storeId }, orderBy: { number: "asc" }, take: CAP,
        include: { customer: { select: { membershipNumber: true } }, createdBy: { select: { email: true } }, refundOf: { select: { number: true } } },
      });
      return {
        filename: "transactions",
        headers: ["number", "type", "created", "member_number", "employee", "subtotal", "tax", "total", "payment_method", "cash_tendered", "balance_change", "credit_change", "refund_of", "voided", "void_reason", "notes"],
        rows: r.map((t) => [t.number, t.type, t.createdAt, t.customer?.membershipNumber ?? null, t.createdBy?.email ?? null, t.subtotal, t.tax, t.total, t.paymentMethod, t.tendered, t.balanceChange, t.creditChange, t.refundOf?.number ?? null, t.voidedAt, t.voidReason, t.notes]),
      };
    }
    case "transaction-items": {
      const r = await db.transactionItem.findMany({ where: { storeId }, orderBy: [{ transaction: { number: "asc" } }, { description: "asc" }], take: CAP, include: { transaction: { select: { number: true } } } });
      return {
        filename: "transaction-items",
        headers: ["transaction_number", "kind", "sku", "description", "quantity", "unit_price", "line_total", "taxable", "refunded_quantity"],
        rows: r.map((i) => [i.transaction.number, i.kind, i.sku, i.description, i.quantity, i.unitPrice, i.lineTotal, i.taxable, i.refundedQty]),
      };
    }
    case "merchandise": {
      const r = await db.concessionItem.findMany({ where: { storeId }, orderBy: { sku: "asc" }, take: CAP, include: { category: { select: { name: true } } } });
      return {
        filename: "merchandise",
        headers: ["sku", "name", "category", "retail_price", "cost_price", "quantity_on_hand", "low_stock_threshold", "taxable", "active", "barcode"],
        rows: r.map((m) => [m.sku, m.name, m.category.name, m.retailPrice, m.costPrice, m.quantityOnHand, m.lowStockThreshold, m.taxable, m.active, m.barcode]),
      };
    }
  }
}

/** Everything in one JSON document (a portable backup; each table is an array of objects keyed by column). */
export async function exportAll(storeId: string, store: { name: string; number: string }) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const kind of EXPORT_KINDS) {
    const t = await exportTable(kind, storeId);
    tables[kind] = t.rows.map((row) => Object.fromEntries(t.headers.map((h, i) => [h, row[i] instanceof Date ? (row[i] as Date).toISOString() : row[i] !== null && typeof row[i] === "object" ? String(row[i]) : row[i]])));
  }
  return { app: "VideoMaster", exportedAt: new Date().toISOString(), store, tables };
}

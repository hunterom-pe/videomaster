// Shared by client forms and server actions (no server-only imports here).
import { z } from "zod";
import { isValidTimeZone } from "@/lib/tz";

export const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD"] as const;

export const FORMAT_OPTIONS = [
  { value: "VHS", label: "VHS" },
  { value: "DVD", label: "DVD" },
  { value: "BLURAY", label: "BLU-RAY" },
  { value: "LASERDISC", label: "LASERDISC" },
  { value: "VIDEO_GAME", label: "VIDEO GAMES" },
  { value: "OTHER", label: "OTHER" },
] as const;
const FORMAT_VALUES = FORMAT_OPTIONS.map((f) => f.value) as [string, ...string[]];

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} IS REQUIRED`).max(max, `${label} MUST BE ${max} CHARACTERS OR FEWER`);

/** Numeric text field with min/max/decimal-place checks; returns a number. */
function numberField(label: string, opts: { min: number; max: number; decimals: number; integer?: boolean }) {
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") {
        ctx.addIssue({ code: "custom", message: `${label} IS REQUIRED` });
        return z.NEVER;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: `${label} MUST BE A NUMBER` });
        return z.NEVER;
      }
      if (n < opts.min) {
        ctx.addIssue({
          code: "custom",
          message: opts.min === 0 ? `${label} CANNOT BE NEGATIVE` : `${label} MUST BE AT LEAST ${opts.min}`,
        });
        return z.NEVER;
      }
      if (n > opts.max) {
        ctx.addIssue({ code: "custom", message: `${label} MUST BE ${opts.max} OR LESS` });
        return z.NEVER;
      }
      const places = raw.includes(".") ? raw.split(".")[1].length : 0;
      if (opts.integer && !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: `${label} MUST BE A WHOLE NUMBER` });
        return z.NEVER;
      }
      if (places > opts.decimals) {
        ctx.addIssue({ code: "custom", message: `${label} MAY HAVE AT MOST ${opts.decimals} DECIMAL PLACES` });
        return z.NEVER;
      }
      return n;
    });
}

/** Optional non-negative money/count field: blank means 0. */
function optionalNumber(label: string, opts: { max: number; decimals: number; integer?: boolean }) {
  const inner = numberField(label, { min: 0, ...opts });
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return 0;
      const r = inner.safeParse(raw);
      if (!r.success) {
        ctx.addIssue({ code: "custom", message: r.error.issues[0].message });
        return z.NEVER;
      }
      return r.data;
    });
}

/** Categories every new store starts with (editable in Store Settings). Prefix = letter for auto SKUs (C001). */
export const DEFAULT_CONCESSION_CATEGORIES: { name: string; prefix: string }[] = [
  { name: "CANDY", prefix: "C" }, { name: "POPCORN", prefix: "P" }, { name: "DRINKS", prefix: "D" },
  { name: "SNACKS", prefix: "S" }, { name: "VIDEO ACCESSORIES", prefix: "A" }, { name: "OTHER", prefix: "O" },
];

export const concessionCategorySchema = z.object({
  id: z.string().optional(),
  name: text("CATEGORY NAME", 30),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z]$/, "SKU LETTER MUST BE A SINGLE LETTER A-Z"),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: text("CATEGORY NAME", 30),
  rentalPrice: numberField("RENTAL PRICE", { min: 0, max: 999.99, decimals: 2 }),
  rentalDays: numberField("RENTAL DURATION", { min: 1, max: 90, decimals: 0, integer: true }),
  lateFeePerDay: numberField("LATE FEE", { min: 0, max: 99.99, decimals: 2 }),
});

export const storeSchema = z
  .object({
    name: text("STORE NAME", 60),
    number: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, "STORE NUMBER MUST BE 1 TO 6 DIGITS"),
    address: text("ADDRESS", 100),
    city: text("CITY", 60),
    region: text("STATE / REGION", 40),
    postalCode: text("POSTAL CODE", 12),
    phone: z
      .string()
      .trim()
      .min(1, "PHONE NUMBER IS REQUIRED")
      .max(30, "PHONE NUMBER IS TOO LONG")
      .regex(/^[0-9()+\-.\sx]+$/i, "PHONE NUMBER MAY ONLY CONTAIN DIGITS AND ( ) + - . x"),
    managerName: text("MANAGER / OWNER NAME", 60),
    slogan: z.string().trim().max(80, "SLOGAN MUST BE 80 CHARACTERS OR FEWER").optional().default(""),
    currency: z.enum(CURRENCIES, "SELECT A CURRENCY"),
    timezone: z.string().trim().refine(isValidTimeZone, "SELECT A VALID TIME ZONE"),
    salesTaxPercent: numberField("SALES TAX", { min: 0, max: 30, decimals: 3 }),
    storeYear: z
      .string()
      .trim()
      .transform((raw, ctx) => {
        if (raw === "") return null;
        if (!/^\d{4}$/.test(raw) || Number(raw) < 1900 || Number(raw) > 2100) {
          ctx.addIssue({ code: "custom", message: "STORE YEAR MUST BE A 4-DIGIT YEAR (1900-2100) OR LEFT BLANK" });
          return z.NEVER;
        }
        return Number(raw);
      }),
    onlyMoviesUpToStoreYear: z.boolean(),
    rewindFee: optionalNumber("REWIND FEE", { max: 999.99, decimals: 2 }),
    damageFee: optionalNumber("DAMAGE FEE", { max: 999.99, decimals: 2 }),
    lostItemFee: optionalNumber("LOST-ITEM FEE", { max: 999.99, decimals: 2 }),
    replacementFee: optionalNumber("REPLACEMENT COST", { max: 999.99, decimals: 2 }),
    membershipFee: optionalNumber("MEMBERSHIP FEE", { max: 999.99, decimals: 2 }),
    membershipTermMonths: optionalNumber("MEMBERSHIP TERM", { max: 120, decimals: 0, integer: true }),
    maxRentalsOut: optionalNumber("MAXIMUM VIDEOS OUT", { max: 99, decimals: 0, integer: true }),
    defaultLowStock: optionalNumber("DEFAULT LOW-STOCK THRESHOLD", { max: 9999, decimals: 0, integer: true }),
    formatDefaults: z.record(z.string(), z.string()),
    functionKeys: z.boolean(),
    receiptFooter: z.string().trim().max(40, "RECEIPT MESSAGE MUST BE 40 CHARACTERS OR FEWER"),
    formats: z
      .array(z.enum(FORMAT_VALUES))
      .min(1, "SELECT AT LEAST ONE FORMAT")
      .transform((f) => [...new Set(f)]),
    categories: z.array(categorySchema).min(1, "AT LEAST ONE RENTAL CATEGORY IS REQUIRED").max(20, "MAXIMUM 20 CATEGORIES"),
    concessionCategories: z.array(concessionCategorySchema).min(1, "AT LEAST ONE MERCHANDISE CATEGORY IS REQUIRED").max(20, "MAXIMUM 20 MERCHANDISE CATEGORIES"),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    val.categories.forEach((c, i) => {
      const key = c.name.toUpperCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["categories", i, "name"], message: "DUPLICATE CATEGORY NAME" });
      seen.add(key);
    });
    const seenMerch = new Set<string>();
    val.concessionCategories.forEach((c, i) => {
      const key = c.name.toUpperCase();
      if (seenMerch.has(key)) ctx.addIssue({ code: "custom", path: ["concessionCategories", i, "name"], message: "DUPLICATE CATEGORY NAME" });
      seenMerch.add(key);
    });
  });

/** Raw (string-based) form state; what the browser holds and submits. */
export type StoreFormValues = {
  name: string;
  number: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  managerName: string;
  slogan: string;
  currency: string;
  timezone: string;
  salesTaxPercent: string;
  storeYear: string;
  onlyMoviesUpToStoreYear: boolean;
  rewindFee: string;
  damageFee: string;
  lostItemFee: string;
  replacementFee: string;
  membershipFee: string;
  membershipTermMonths: string;
  maxRentalsOut: string;
  defaultLowStock: string;
  /** format -> rental category id preselected when adding copies ("" = none). Existing categories only. */
  formatDefaults: Record<string, string>;
  functionKeys: boolean;
  receiptFooter: string;
  formats: string[];
  categories: { id?: string; name: string; rentalPrice: string; rentalDays: string; lateFeePerDay: string }[];
  concessionCategories: { id?: string; name: string; prefix: string }[];
};

export type ActionState =
  | { ok: false; errors: Record<string, string>; message: string; values?: { email?: string } }
  | undefined;

export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export const DEFAULT_CATEGORIES: StoreFormValues["categories"] = [
  { name: "NEW RELEASE", rentalPrice: "3.99", rentalDays: "2", lateFeePerDay: "1.00" },
  { name: "CATALOG", rentalPrice: "1.99", rentalDays: "5", lateFeePerDay: "1.00" },
  { name: "KIDS", rentalPrice: "0.99", rentalDays: "5", lateFeePerDay: "1.00" },
];

// ── Auth ──
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("ENTER A VALID E-MAIL ADDRESS").max(200),
  password: z.string().min(10, "PASSWORD MUST BE AT LEAST 10 CHARACTERS").max(128, "PASSWORD IS TOO LONG"),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("ENTER A VALID E-MAIL ADDRESS"),
  password: z.string().min(1, "ENTER YOUR PASSWORD").max(128),
});

// ── Customers ──
export const CUSTOMER_STATUSES = ["GOOD", "OVERDUE", "BLOCKED", "SUSPENDED", "CLOSED"] as const;

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} MUST BE ${max} CHARACTERS OR FEWER`);

export const customerSchema = z.object({
  firstName: text("FIRST NAME", 40),
  lastName: text("LAST NAME", 40),
  phone: z
    .string()
    .trim()
    .max(30, "PHONE NUMBER IS TOO LONG")
    .regex(/^[0-9()+\-.\sx]*$/i, "PHONE NUMBER MAY ONLY CONTAIN DIGITS AND ( ) + - . x"),
  email: z.string().trim().max(200, "E-MAIL IS TOO LONG").refine((v) => v === "" || z.email().safeParse(v).success, "ENTER A VALID E-MAIL ADDRESS OR LEAVE BLANK"),
  address: optionalText("ADDRESS", 100),
  city: optionalText("CITY", 60),
  region: optionalText("STATE", 40),
  postalCode: optionalText("POSTAL CODE", 12),
  dateOfBirth: z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return null;
      const d = new Date(`${raw}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
        ctx.addIssue({ code: "custom", message: "DATE OF BIRTH MUST BE A VALID DATE (YYYY-MM-DD) OR BLANK" });
        return z.NEVER;
      }
      if (d.getUTCFullYear() < 1900 || d > new Date()) {
        ctx.addIssue({ code: "custom", message: "DATE OF BIRTH MUST BE BETWEEN 1900 AND TODAY" });
        return z.NEVER;
      }
      return d;
    }),
  status: z.enum(CUSTOMER_STATUSES, "SELECT AN ACCOUNT STATUS"),
  notes: optionalText("NOTES", 1000),
});

export type CustomerFormValues = {
  firstName: string; lastName: string; phone: string; email: string; address: string; city: string;
  region: string; postalCode: string; dateOfBirth: string; status: string; notes: string;
  /** New customers only: collect the store membership fee now. */
  collectFee?: boolean;
  paymentMethod?: string;
  tendered?: string;
};

// ── Inventory ──
export const COPY_CONDITIONS = ["NEW", "EXCELLENT", "GOOD", "FAIR", "POOR"] as const;
export const EDITABLE_COPY_STATUSES = ["AVAILABLE", "DAMAGED", "REPAIR", "LOST", "RETIRED"] as const;

const quantityField = numberField("QUANTITY", { min: 1, max: 100, decimals: 0, integer: true });
const costField = numberField("REPLACEMENT COST", { min: 0, max: 999.99, decimals: 2 });

export const addCopiesSchema = z.object({
  format: z.enum(FORMAT_VALUES, "SELECT A FORMAT"),
  categoryId: z.string().min(1, "SELECT A RENTAL CATEGORY"),
  quantity: quantityField,
  replacementCost: costField,
});

export const addTitleSchema = addCopiesSchema.extend({
  title: text("TITLE", 150),
  year: z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return null;
      if (!/^\d{4}$/.test(raw) || Number(raw) < 1880 || Number(raw) > 2100) {
        ctx.addIssue({ code: "custom", message: "YEAR MUST BE A 4-DIGIT YEAR (1880-2100) OR BLANK" });
        return z.NEVER;
      }
      return Number(raw);
    }),
  director: optionalText("DIRECTOR", 100),
  runtime: z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        ctx.addIssue({ code: "custom", message: "RUNTIME MUST BE 1-1000 WHOLE MINUTES OR BLANK" });
        return z.NEVER;
      }
      return n;
    }),
  genres: optionalText("GENRES", 200),
  cast: optionalText("CAST", 400),
  rating: optionalText("RATING", 10),
  overview: optionalText("PLOT SUMMARY", 2000),
  tmdbId: z.string().trim().regex(/^\d{0,10}$/, "INVALID MOVIE DATABASE ID"),
  posterPath: z.string().trim().refine((v) => v === "" || /^\/[\w.-]{1,100}$/.test(v), "INVALID POSTER PATH"),
});

export const copyEditSchema = z.object({
  status: z.enum(EDITABLE_COPY_STATUSES, "SELECT A STATUS"),
  condition: z.enum(COPY_CONDITIONS, "SELECT A CONDITION"),
  categoryId: z.string().min(1, "SELECT A RENTAL CATEGORY"),
  barcode: z.string().trim().max(40, "BARCODE IS TOO LONG").regex(/^[\w-]*$/, "BARCODE MAY ONLY CONTAIN LETTERS, DIGITS, - AND _"),
  replacementCost: costField,
  notes: optionalText("NOTES", 500),
});

export type AddCopiesValues = { format: string; categoryId: string; quantity: string; replacementCost: string };
export type AddTitleValues = AddCopiesValues & {
  title: string; year: string; director: string; runtime: string; genres: string; cast: string;
  rating: string; overview: string; tmdbId: string; posterPath: string;
};
export type CopyEditValues = {
  status: string; condition: string; categoryId: string; barcode: string; replacementCost: string; notes: string;
};

// ── Rentals / checkout ──
export const PAYMENT_METHODS = [
  { value: "CASH", label: "CASH" },
  { value: "CREDIT_CARD", label: "CREDIT CARD" },
  { value: "DEBIT", label: "DEBIT" },
  { value: "CHECK", label: "CHECK" },
  { value: "STORE_CREDIT", label: "STORE CREDIT" },
  { value: "OTHER", label: "OTHER" },
] as const;

export const MAX_RENTALS_PER_CHECKOUT = 20;
export const MAX_SALE_LINES = 30;

export const checkoutSchema = z
  .object({
    copyIds: z
      .array(z.string().min(1))
      .max(MAX_RENTALS_PER_CHECKOUT, `MAXIMUM ${MAX_RENTALS_PER_CHECKOUT} VIDEOS PER TRANSACTION`)
      .refine((ids) => new Set(ids).size === ids.length, "THE SAME COPY WAS ADDED TWICE"),
    items: z
      .array(z.object({ itemId: z.string().min(1), quantity: z.number().int("QUANTITY MUST BE A WHOLE NUMBER").min(1, "QUANTITY MUST BE AT LEAST 1").max(99, "QUANTITY MAY NOT EXCEED 99") }))
      .max(MAX_SALE_LINES, `MAXIMUM ${MAX_SALE_LINES} MERCHANDISE LINES PER TRANSACTION`)
      .refine((ls) => new Set(ls.map((l) => l.itemId)).size === ls.length, "THE SAME ITEM APPEARS TWICE"),
    paymentMethod: z.enum(PAYMENT_METHODS.map((p) => p.value) as [string, ...string[]], "SELECT A PAYMENT METHOD"),
    override: z.boolean(),
  })
  .refine((v) => v.copyIds.length + v.items.length > 0, { message: "ADD AT LEAST ONE ITEM BEFORE TAKING PAYMENT", path: ["copyIds"] });
export type CheckoutValues = { copyIds: string[]; items: { itemId: string; quantity: number }[]; paymentMethod: string; override: boolean; tendered?: string };

// ── Returns ──
export const RETURN_OUTCOMES = ["RETURNED", "DAMAGED", "LOST"] as const;
export const returnSchema = z.object({
  outcome: z.enum(RETURN_OUTCOMES, "SELECT A RETURN OUTCOME"),
  lateFee: numberField("LATE FEE", { min: 0, max: 999.99, decimals: 2 }),
  otherFee: numberField("DAMAGE / REPLACEMENT FEE", { min: 0, max: 999.99, decimals: 2 }),
  paymentMethod: z.enum(PAYMENT_METHODS.map((p) => p.value) as [string, ...string[]], "SELECT A PAYMENT METHOD"),
  notRewound: z.boolean(),
});
export type ReturnValues = { outcome: string; lateFee: string; otherFee: string; paymentMethod: string; notRewound: boolean; tendered?: string; paidNow?: string };

// ── Concessions ──
export const concessionSchema = z.object({
  sku: z.string().trim().toUpperCase().regex(/^([A-Z0-9-]{1,12})?$/, "SKU MAY ONLY CONTAIN LETTERS, DIGITS AND - (MAX 12)"),
  name: text("ITEM NAME", 60),
  categoryId: z.string().min(1, "SELECT A CATEGORY"),
  retailPrice: numberField("RETAIL PRICE", { min: 0, max: 999.99, decimals: 2 }),
  costPrice: z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return null;
      const r = numberField("COST", { min: 0, max: 999.99, decimals: 2 }).safeParse(raw);
      if (!r.success) {
        ctx.addIssue({ code: "custom", message: r.error.issues[0].message });
        return z.NEVER;
      }
      return r.data;
    }),
  quantityOnHand: numberField("QUANTITY ON HAND", { min: 0, max: 99999, decimals: 0, integer: true }),
  lowStockThreshold: numberField("LOW-STOCK THRESHOLD", { min: 0, max: 9999, decimals: 0, integer: true }),
  taxable: z.boolean(),
  active: z.boolean(),
  barcode: z.string().trim().max(40, "BARCODE IS TOO LONG").regex(/^[\w-]*$/, "BARCODE MAY ONLY CONTAIN LETTERS, DIGITS, - AND _"),
});
export type ConcessionFormValues = {
  sku: string; name: string; categoryId: string; retailPrice: string; costPrice: string; quantityOnHand: string;
  lowStockThreshold: string; taxable: boolean; active: boolean; barcode: string;
};

export const addStockSchema = z.object({ amount: numberField("AMOUNT", { min: 1, max: 99999, decimals: 0, integer: true }) });

// ── Voids / refunds ──
const reasonField = z.string().trim().min(3, "ENTER A REASON (AT LEAST 3 CHARACTERS)").max(120, "REASON MAY NOT EXCEED 120 CHARACTERS");
export const voidSchema = z.object({ reason: reasonField });
export const refundSchema = z.object({
  reason: reasonField,
  paymentMethod: z.enum(PAYMENT_METHODS.map((p) => p.value) as [string, ...string[]], "SELECT HOW THE MONEY IS RETURNED"),
  merchandise: z
    .array(z.object({ itemId: z.string().min(1), qty: z.number().int("QUANTITY MUST BE A WHOLE NUMBER").min(1).max(999), restock: z.boolean() }))
    .max(MAX_SALE_LINES)
    .refine((ls) => new Set(ls.map((l) => l.itemId)).size === ls.length, "THE SAME ITEM APPEARS TWICE"),
  rentalIds: z.array(z.string().min(1)).max(MAX_RENTALS_PER_CHECKOUT).refine((ids) => new Set(ids).size === ids.length, "THE SAME RENTAL APPEARS TWICE"),
  wholeFee: z.boolean(),
});
export type RefundValues = z.input<typeof refundSchema>;

// ── Account balances ──
export const balancePaySchema = z.object({
  amount: z.string().trim().max(12, "AMOUNT IS TOO LONG"),
  paymentMethod: z.enum(PAYMENT_METHODS.map((p) => p.value) as [string, ...string[]], "SELECT A PAYMENT METHOD"),
});
export const balanceWaiveSchema = z.object({
  amount: z.string().trim().max(12, "AMOUNT IS TOO LONG"),
  reason: reasonField,
});

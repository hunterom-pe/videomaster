// Shared by client forms and server actions (no server-only imports here).
import { z } from "zod";

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
    formats: z
      .array(z.enum(FORMAT_VALUES))
      .min(1, "SELECT AT LEAST ONE FORMAT")
      .transform((f) => [...new Set(f)]),
    categories: z.array(categorySchema).min(1, "AT LEAST ONE RENTAL CATEGORY IS REQUIRED").max(20, "MAXIMUM 20 CATEGORIES"),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    val.categories.forEach((c, i) => {
      const key = c.name.toUpperCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["categories", i, "name"], message: "DUPLICATE CATEGORY NAME" });
      seen.add(key);
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
  salesTaxPercent: string;
  storeYear: string;
  onlyMoviesUpToStoreYear: boolean;
  formats: string[];
  categories: { id?: string; name: string; rentalPrice: string; rentalDays: string; lateFeePerDay: string }[];
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

import type { MediaFormat } from "@/generated/prisma/client";
import type { storeSchema } from "@/lib/validation";

// Shared by first-run setup and demo-store creation.
export type Parsed = ReturnType<typeof storeSchema.parse>;

const ALL_FORMATS: MediaFormat[] = ["VHS", "DVD", "BLURAY", "LASERDISC", "VIDEO_GAME", "OTHER"];

export const storeFields = (d: Parsed) => ({
  name: d.name,
  number: d.number.padStart(4, "0"),
  address: d.address,
  city: d.city,
  region: d.region,
  postalCode: d.postalCode,
  phone: d.phone,
  managerName: d.managerName,
  slogan: d.slogan || null,
});

export const settingsFields = (d: Parsed) => ({
  currency: d.currency,
  timezone: d.timezone,
  salesTaxPercent: d.salesTaxPercent.toString(),
  storeYear: d.storeYear,
  onlyMoviesUpToStoreYear: d.storeYear !== null && d.onlyMoviesUpToStoreYear,
  rewindFee: d.rewindFee.toFixed(2),
  damageFee: d.damageFee.toFixed(2),
  lostItemFee: d.lostItemFee.toFixed(2),
  replacementFee: d.replacementFee.toFixed(2),
  membershipFee: d.membershipFee.toFixed(2),
  membershipTermMonths: d.membershipTermMonths,
  maxRentalsOut: d.maxRentalsOut,
  defaultLowStockThreshold: d.defaultLowStock,
  functionKeys: d.functionKeys,
  receiptFooter: d.receiptFooter || "THANK YOU!",
});

export const formatRows = (d: Parsed) =>
  ALL_FORMATS.map((format) => ({ format, enabled: d.formats.includes(format) }));

export const categoryFields = (c: Parsed["categories"][number], sortOrder: number) => ({
  name: c.name,
  rentalPrice: c.rentalPrice.toFixed(2),
  rentalDays: c.rentalDays,
  lateFeePerDay: c.lateFeePerDay.toFixed(2),
  sortOrder,
});

export const concessionCategoryFields = (c: Parsed["concessionCategories"][number], sortOrder: number) => ({
  name: c.name.toUpperCase(),
  prefix: c.prefix,
  sortOrder,
});


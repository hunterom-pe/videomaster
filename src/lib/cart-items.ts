import "server-only";
import { FORMAT_LABELS } from "@/lib/inventory";
import { toCents } from "@/lib/pricing";
import type { CartItem } from "@/actions/rentals";

// Shape of a rentable copy in the checkout cart. Shared by the copy search and "rent again".
export const toCartItem = (c: {
  id: string; copyNumber: string; format: keyof typeof FORMAT_LABELS;
  movieTitle: { title: string; year: number | null };
  rentalCategory: { name: string; rentalPrice: { toString(): string }; rentalDays: number; taxable: boolean } | null;
}): CartItem | null =>
  c.rentalCategory
    ? {
        copyId: c.id, copyNumber: c.copyNumber, title: c.movieTitle.title, year: c.movieTitle.year,
        format: FORMAT_LABELS[c.format], categoryName: c.rentalCategory.name,
        priceCents: toCents(c.rentalCategory.rentalPrice), days: c.rentalCategory.rentalDays, taxable: c.rentalCategory.taxable,
      }
    : null;

export const copyInclude = {
  movieTitle: { select: { title: true, year: true } },
  rentalCategory: { select: { name: true, rentalPrice: true, rentalDays: true, taxable: true } },
} as const;


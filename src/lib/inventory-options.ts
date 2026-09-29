import "server-only";
import { FORMAT_OPTIONS } from "@/lib/validation";
import type { requireStore } from "@/lib/store-access";

type Store = Awaited<ReturnType<typeof requireStore>>["store"];

export const categoryOptions = (store: Store) =>
  store.rentalCategories.map((c) => ({ id: c.id, name: c.name, price: c.rentalPrice.toFixed(2), days: c.rentalDays }));

export const formatOptions = (store: Store) =>
  FORMAT_OPTIONS.filter((f) => store.formats.some((sf) => sf.enabled && sf.format === f.value)).map((f) => ({ value: f.value, label: f.label }));

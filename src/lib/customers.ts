import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const PAGE_SIZE = 25;

/** Forgiving search: every whitespace-separated term must match name, phone, membership # or ID. */
export function customerSearchWhere(storeId: string, q: string): Prisma.CustomerWhereInput {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    storeId,
    AND: terms.map((t) => {
      const digits = t.replace(/\D/g, "");
      return {
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { membershipNumber: { contains: t, mode: "insensitive" as const } },
          { id: t },
          // phone is stored with punctuation; phoneDigits lets "6025550199" match "(602) 555-0199"
          ...(digits.length >= 3 ? [{ phoneDigits: { contains: digits } }] : []),
        ],
      };
    }),
  };
}

export async function searchCustomers(storeId: string, q: string, page: number) {
  const where = customerSearchWhere(storeId, q);
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

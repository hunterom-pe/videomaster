import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Require a logged-in user or redirect to /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The store the current user belongs to, resolved server-side from their
 * membership. Store IDs are never accepted from the browser.
 * Version 1.0: a user works with their first (oldest) store.
 */
export const getUserStore = cache(async (userId: string) => {
  const membership = await db.storeMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      store: { include: { settings: true, formats: true, rentalCategories: { where: { active: true }, orderBy: { sortOrder: "asc" } } } },
    },
  });
  return membership ? { role: membership.role, store: membership.store } : null;
});

/** Require a logged-in user WITH a store; sends new users to first-run setup. */
export async function requireStore() {
  const user = await requireUser();
  const membership = await getUserStore(user.id);
  if (!membership) redirect("/setup");
  return { user, ...membership };
}

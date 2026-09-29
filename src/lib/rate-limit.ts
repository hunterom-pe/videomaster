import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** DB-backed so it holds across serverless instances (Netlify). */
export async function isRateLimited(keys: string[]): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const counts = await Promise.all(keys.map((key) => db.loginAttempt.count({ where: { key, createdAt: { gt: since } } })));
  return counts.some((c) => c >= MAX_FAILURES);
}

export async function recordFailure(keys: string[], userId?: string) {
  await db.loginAttempt.createMany({ data: keys.map((key) => ({ key, userId })) });
  // opportunistic cleanup
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } } });
}

import { db } from "@/lib/db";

// Public, read-only health check: is the app up and can it reach the database? Returns no secrets and no connection
// details (the full error goes to the server log, e.g. Netlify function logs). Handy for monitoring and for telling
// "the site is down" from "the database is unreachable / out of connections".
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("database check timed out after 5s")), 5000)),
    ]);
    return Response.json({ ok: true, app: "VideoMaster", database: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health] database check failed:", e);
    const code = (e as { code?: string }).code;
    return Response.json({ ok: false, app: "VideoMaster", database: "unreachable", code: code ?? null, ms: Date.now() - started }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

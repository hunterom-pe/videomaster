import { toCsv } from "@/lib/csv";
import { EXPORT_KINDS, exportAll, exportTable, type ExportKind } from "@/lib/export";
import { requireStore } from "@/lib/store-access";

// Owner/manager only; always scoped to the session's store. Not cached.
export const dynamic = "force-dynamic";

const stamp = () => new Date().toISOString().slice(0, 10);
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { store, role } = await requireStore();
  if (role === "EMPLOYEE") return new Response("Only an owner or manager can export store data.", { status: 403, headers: noStore });
  const { kind } = await params;
  const safeName = store.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store";

  if (kind === "backup") {
    const data = await exportAll(store.id, { name: store.name, number: store.number });
    return new Response(JSON.stringify(data, null, 1), {
      headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="videomaster-${safeName}-backup-${stamp()}.json"` },
    });
  }
  if (!(EXPORT_KINDS as readonly string[]).includes(kind)) return new Response("Unknown export.", { status: 404, headers: noStore });
  const t = await exportTable(kind as ExportKind, store.id);
  return new Response(toCsv(t.headers, t.rows), {
    headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="videomaster-${safeName}-${t.filename}-${stamp()}.csv"` },
  });
}

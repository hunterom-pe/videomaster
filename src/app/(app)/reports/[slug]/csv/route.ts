import { toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/report-range";
import { customerBalances, listOverdue, merchandiseInventory, popularRentals, topCustomers } from "@/lib/reports";
import { requireStore } from "@/lib/store-access";

// CSV of a list-type report (same data and filters as the on-screen report). Scoped to the session's store.
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const money = (c: number) => (c / 100).toFixed(2);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { store } = await requireStore();
  const tz = store.settings!.timezone;
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  let headers: string[];
  let rows: (string | number | boolean | Date | null | { toString(): string })[][];

  if (slug === "overdue") {
    const { rows: r } = await listOverdue(store.id, tz);
    headers = ["customer", "phone", "title", "copy_number", "due_date", "days_overdue", "current_late_fee", "customer_total_owed"];
    rows = r.map((x) => [x.customerName, x.phone, x.title, x.copyNumber, x.dueAt.toISOString().slice(0, 10), x.daysLate, money(x.feeCents), money(x.balanceCents)]);
  } else if (slug === "popular") {
    const r = await popularRentals(store.id, resolveRange(sp.get("from") ?? undefined, sp.get("to") ?? undefined, 30, tz), 1000);
    headers = ["rank", "title", "year", "rentals"];
    rows = r.map((x, i) => [i + 1, x.title, x.year, x.count]);
  } else if (slug === "customers") {
    const r = await topCustomers(store.id, resolveRange(sp.get("from") ?? undefined, sp.get("to") ?? undefined, 30, tz), 1000);
    headers = ["rank", "customer", "member_number", "rentals", "rental_spend"];
    rows = r.map((x, i) => [i + 1, x.name, x.member, x.count, money(x.spentCents)]);
  } else if (slug === "balances") {
    const { rows: r } = await customerBalances(store.id);
    headers = ["customer", "member_number", "phone", "balance_due"];
    rows = r.map((x) => [x.name, x.member, x.phone, money(x.cents)]);
  } else if (slug === "merchandise") {
    const { items } = await merchandiseInventory(store.id);
    headers = ["sku", "name", "category", "retail_price", "quantity_on_hand", "low_stock_threshold"];
    rows = items.map((i) => [i.sku, i.name, i.category.name, i.retailPrice, i.quantityOnHand, i.lowStockThreshold]);
  } else {
    return new Response("This report has no CSV export.", { status: 404, headers: noStore });
  }
  return new Response(toCsv(headers, rows), {
    headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="videomaster-report-${slug}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

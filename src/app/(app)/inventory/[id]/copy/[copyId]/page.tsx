import { notFound } from "next/navigation";
import { CopyForm } from "@/components/InventoryForms";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { categoryOptions } from "@/lib/inventory-options";
import { fmtDateUS } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export default async function CopyPage({ params }: { params: Promise<{ id: string; copyId: string }> }) {
  const { user, store } = await requireStore();
  const { id, copyId } = await params;
  const c = await db.inventoryCopy.findFirst({ where: { id: copyId, movieTitleId: id, storeId: store.id }, include: { movieTitle: true } });
  if (!c) notFound();
  const locked = c.status === "RENTED" || c.status === "OVERDUE";
  return (
    <Screen title="EDIT COPY" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>COPY {c.copyNumber}</h1>
      <div className="vm-cyan">{c.movieTitle.title.toUpperCase()} — {FORMAT_LABELS[c.format]} · ADDED {fmtDateUS(c.acquiredAt, store.settings!.timezone)}</div>
      <hr className="vm-rule" />
      <CopyForm
        copyId={c.id} titleId={id} locked={locked} categories={categoryOptions(store)}
        initial={{
          status: locked ? "AVAILABLE" : c.status, condition: c.condition ?? "GOOD",
          categoryId: c.rentalCategoryId ?? categoryOptions(store)[0]?.id ?? "", barcode: c.barcode ?? "",
          replacementCost: c.replacementCost?.toFixed(2) ?? "0.00", notes: c.notes ?? "",
        }}
      />
    </Screen>
  );
}

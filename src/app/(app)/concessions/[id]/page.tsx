import { notFound } from "next/navigation";
import { AddStockForm, ConcessionForm } from "@/components/ConcessionForms";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "EDIT MERCHANDISE" };

export default async function EditConcessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const { id } = await params;
  const i = await db.concessionItem.findFirst({ where: { id, storeId: store.id } });
  if (!i) notFound();
  const categories = store.concessionCategories.map((c) => ({ id: c.id, name: c.name }));
  if (!categories.some((c) => c.id === i.categoryId)) {
    const retired = await db.concessionCategory.findFirst({ where: { id: i.categoryId, storeId: store.id }, select: { id: true, name: true } });
    if (retired) categories.push({ id: retired.id, name: `${retired.name} (RETIRED)` });
  }
  return (
    <Screen title="EDIT MERCHANDISE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>{i.sku} — {i.name.toUpperCase()}</h1>
      <div className="vm-cyan">{i.quantityOnHand} ON HAND</div>
      <hr className="vm-rule" />
      <fieldset className="vm-section">
        <legend>RECEIVE STOCK</legend>
        <AddStockForm itemId={i.id} />
      </fieldset>
      <ConcessionForm
        itemId={i.id}
        categories={categories}
        initial={{
          sku: i.sku, name: i.name, categoryId: i.categoryId, retailPrice: i.retailPrice.toFixed(2), costPrice: i.costPrice?.toFixed(2) ?? "",
          quantityOnHand: String(i.quantityOnHand), lowStockThreshold: String(i.lowStockThreshold), taxable: i.taxable, active: i.active, barcode: i.barcode ?? "",
        }}
      />
    </Screen>
  );
}

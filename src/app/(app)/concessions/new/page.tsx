import { ConcessionForm } from "@/components/ConcessionForms";
import { EMPTY_CONCESSION } from "@/lib/form-defaults";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "ADD MERCHANDISE" };

export default async function NewConcessionPage() {
  const { user, store } = await requireStore();
  return (
    <Screen title="ADD MERCHANDISE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>NEW MERCHANDISE ITEM</h1>
      <hr className="vm-rule" />
      <ConcessionForm initial={{ ...EMPTY_CONCESSION, categoryId: store.concessionCategories[0]?.id ?? "", lowStockThreshold: String(store.settings!.defaultLowStockThreshold) }} categories={store.concessionCategories.map((c) => ({ id: c.id, name: c.name }))} />
    </Screen>
  );
}

import { ConcessionForm, EMPTY_CONCESSION } from "@/components/ConcessionForms";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "ADD MERCHANDISE" };

export default async function NewConcessionPage() {
  const { user, store } = await requireStore();
  return (
    <Screen title="ADD MERCHANDISE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>NEW MERCHANDISE ITEM</h1>
      <hr className="vm-rule" />
      <ConcessionForm initial={EMPTY_CONCESSION} />
    </Screen>
  );
}

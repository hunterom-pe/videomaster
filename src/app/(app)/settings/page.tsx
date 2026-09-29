import { Screen } from "@/components/Screen";
import { StoreForm } from "@/components/StoreForm";
import { requireStore } from "@/lib/store-access";
import type { StoreFormValues } from "@/lib/validation";

export default async function SettingsPage() {
  const { user, store } = await requireStore();
  const s = store.settings!;
  const initial: StoreFormValues = {
    name: store.name,
    number: store.number,
    address: store.address,
    city: store.city,
    region: store.region,
    postalCode: store.postalCode,
    phone: store.phone,
    managerName: store.managerName,
    slogan: store.slogan ?? "",
    currency: s.currency,
    salesTaxPercent: s.salesTaxPercent.toString(),
    storeYear: s.storeYear?.toString() ?? "",
    onlyMoviesUpToStoreYear: s.onlyMoviesUpToStoreYear,
    formats: store.formats.filter((f) => f.enabled).map((f) => f.format),
    categories: store.rentalCategories.map((c) => ({
      id: c.id,
      name: c.name,
      rentalPrice: c.rentalPrice.toFixed(2),
      rentalDays: String(c.rentalDays),
      lateFeePerDay: c.lateFeePerDay.toFixed(2),
    })),
  };
  return (
    <Screen title="STORE SETTINGS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`} status="EDITING STORE SETTINGS">
      <div className="vm-center">
        <h1>STORE SETTINGS</h1>
        <div className="vm-cyan">STORE: {store.name} #{store.number}</div>
      </div>
      <hr className="vm-rule" />
      <StoreForm mode="settings" initial={initial} />
    </Screen>
  );
}

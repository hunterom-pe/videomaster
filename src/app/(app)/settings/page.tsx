import { Screen } from "@/components/Screen";
import { SamplePanel } from "@/components/SamplePanel";
import { StoreForm } from "@/components/StoreForm";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import type { StoreFormValues } from "@/lib/validation";

export const metadata = { title: "STORE SETTINGS" };

export default async function SettingsPage() {
  const { user, store, role } = await requireStore();
  const [customers, titles, items, transactions] = await Promise.all([
    db.customer.count({ where: { storeId: store.id } }),
    db.movieTitle.count({ where: { storeId: store.id } }),
    db.concessionItem.count({ where: { storeId: store.id } }),
    db.transaction.count({ where: { storeId: store.id } }),
  ]);
  const isEmpty = customers + titles + items + transactions === 0;
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
    timezone: s.timezone,
    salesTaxPercent: s.salesTaxPercent.toString(),
    storeYear: s.storeYear?.toString() ?? "",
    onlyMoviesUpToStoreYear: s.onlyMoviesUpToStoreYear,
    rewindFee: s.rewindFee.toFixed(2),
    damageFee: s.damageFee.toFixed(2),
    lostItemFee: s.lostItemFee.toFixed(2),
    replacementFee: s.replacementFee.toFixed(2),
    membershipFee: s.membershipFee.toFixed(2),
    membershipTermMonths: String(s.membershipTermMonths),
    maxRentalsOut: String(s.maxRentalsOut),
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
      <hr className="vm-rule" />
      <SamplePanel isEmpty={isEmpty} isOwner={role === "OWNER"} canManage={role !== "EMPLOYEE"} />
    </Screen>
  );
}

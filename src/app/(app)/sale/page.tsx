import Link from "next/link";
import { CheckoutClient } from "@/components/CheckoutClient";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "MERCHANDISE SALE" };

// Walk-in merchandise sale: no customer, no rentals.
export default async function SalePage() {
  const { user, store } = await requireStore();
  return (
    <Screen title="MERCHANDISE SALE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>SELL MERCHANDISE</h1>
        <Link href="/concessions" className="vm-btn">[ CONCESSIONS ]</Link>
      </div>
      <hr className="vm-rule" />
      <CheckoutClient customerId={null} customerName="WALK-IN" status="GOOD" fees="0.00" restrictions={[]} activeOut={0} maxOut={0} timezone={store.settings!.timezone} saleCategories={store.concessionCategories.map((c) => ({ id: c.id, name: c.name }))} canOverride={false} taxPercent={store.settings!.salesTaxPercent.toString()} />
    </Screen>
  );
}

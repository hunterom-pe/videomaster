import { CustomerForm } from "@/components/CustomerForm";
import { EMPTY_CUSTOMER } from "@/lib/form-defaults";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "ADD CUSTOMER" };

export default async function NewCustomerPage() {
  const { user, store } = await requireStore();
  return (
    <Screen title="ADD CUSTOMER" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>NEW CUSTOMER</h1>
      <div className="vm-cyan">A MEMBERSHIP NUMBER IS ASSIGNED WHEN SAVED</div>
      <hr className="vm-rule" />
      <CustomerForm initial={EMPTY_CUSTOMER} membershipFee={store.settings!.membershipFee.toFixed(2)} />
    </Screen>
  );
}

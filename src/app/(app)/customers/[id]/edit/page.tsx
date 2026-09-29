import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/CustomerForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  return (
    <Screen title="EDIT CUSTOMER" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>EDIT CUSTOMER — MEMBER #{c.membershipNumber}</h1>
      <hr className="vm-rule" />
      <CustomerForm
        customerId={c.id}
        initial={{
          firstName: c.firstName, lastName: c.lastName, phone: c.phone ?? "", email: c.email ?? "",
          address: c.address ?? "", city: c.city ?? "", region: c.region ?? "", postalCode: c.postalCode ?? "",
          dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : "", status: c.status, notes: c.notes ?? "",
        }}
      />
    </Screen>
  );
}

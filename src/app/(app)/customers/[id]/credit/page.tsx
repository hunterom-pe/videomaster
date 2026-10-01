import { notFound } from "next/navigation";
import Link from "next/link";
import { CreditForm } from "@/components/CreditForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "STORE CREDIT" };

export default async function CreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  return (
    <Screen title="STORE CREDIT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>STORE CREDIT — {c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</h1>
        <Link href={`/customers/${c.id}`} className="vm-btn">[ ACCOUNT ]</Link>
      </div>
      <hr className="vm-rule" />
      <p className="vm-hint">STORE CREDIT IS MONEY THE CUSTOMER HAS ON ACCOUNT. THEY CAN PAY FOR RENTALS, SALES, FEES AND BALANCES WITH IT. REFUNDS CAN ALSO GO TO STORE CREDIT. CREDIT SOLD IS NOT REVENUE UNTIL IT IS SPENT.</p>
      <CreditForm customerId={c.id} creditCents={toCents(c.storeCredit)} />
    </Screen>
  );
}

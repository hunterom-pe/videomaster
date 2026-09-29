import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/CheckoutClient";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { effectiveStatus, overdueCounts } from "@/lib/overdue";
import { requireStore } from "@/lib/store-access";

export default async function CheckoutPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { user, store, role } = await requireStore();
  const { customerId } = await params;
  const c = await db.customer.findFirst({ where: { id: customerId, storeId: store.id } });
  if (!c) notFound();
  const name = `${c.firstName} ${c.lastName}`.toUpperCase();
  const overdue = (await overdueCounts(store.id, [c.id])).get(c.id) ?? 0;
  const status = effectiveStatus(c.status, overdue);

  return (
    <Screen title="CUSTOMER CHECKOUT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>RENT VIDEO</h1>
        <Link href={`/customers/${c.id}`} className="vm-btn">[ VIEW ACCOUNT ]</Link>
      </div>
      <hr className="vm-rule" />
      {status === "CLOSED" ? (
        <div className="vm-alert" role="alert">
          <strong>*** CUSTOMER ACCOUNT CLOSED ***</strong>
          RENTALS ARE NOT ALLOWED ON A CLOSED ACCOUNT. REOPEN IT ON THE CUSTOMER RECORD FIRST.
          <div className="vm-actions"><Link href={`/customers/${c.id}/edit`} className="vm-btn">[ EDIT ACCOUNT ]</Link><Link href="/rent" className="vm-btn">[ CANCEL ]</Link></div>
        </div>
      ) : (
        <>
          {status !== "GOOD" && (
            <div className="vm-alert" role="alert">
              <strong>*** ACCOUNT {status} ***</strong>
              {overdue > 0 ? `CUSTOMER HAS ${overdue} OVERDUE RENTAL${overdue === 1 ? "" : "S"}. ` : ""}MANAGER OVERRIDE REQUIRED TO RENT TO THIS CUSTOMER. <Link href={`/customers/${c.id}`} style={{ color: "var(--yellow)" }}>VIEW ACCOUNT DETAILS</Link>
            </div>
          )}
          <CheckoutClient
            customerId={c.id} customerName={name} status={status} fees={c.outstandingFees.toFixed(2)}
            needsOverride={status !== "GOOD"} canOverride={role !== "EMPLOYEE"} taxPercent={store.settings!.salesTaxPercent.toString()}
          />
        </>
      )}
    </Screen>
  );
}

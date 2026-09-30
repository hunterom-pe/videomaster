import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/CheckoutClient";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { membershipState } from "@/lib/membership";
import { effectiveStatus, overdueCounts } from "@/lib/overdue";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "CUSTOMER CHECKOUT" };

export default async function CheckoutPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { user, store, role } = await requireStore();
  const tz = store.settings!.timezone;
  const { customerId } = await params;
  const c = await db.customer.findFirst({ where: { id: customerId, storeId: store.id } });
  if (!c) notFound();
  const name = `${c.firstName} ${c.lastName}`.toUpperCase();
  const overdue = (await overdueCounts(store.id, [c.id], tz)).get(c.id) ?? 0;
  const status = effectiveStatus(c.status, overdue);
  const restrictions: string[] = [];
  if (status !== "GOOD") restrictions.push(`ACCOUNT ${status}`);
  if (membershipState(c.membershipExpiresAt, new Date()) === "EXPIRED") restrictions.push("MEMBERSHIP EXPIRED");
  if (Number(c.outstandingFees) > 0) restrictions.push(`BALANCE DUE $${c.outstandingFees.toFixed(2)}`);
  const activeOut = await db.rental.count({ where: { storeId: store.id, customerId: c.id, returnedAt: null } });
  const maxOut = store.settings!.maxRentalsOut;

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
          {restrictions.length > 0 && (
            <div className="vm-alert" role="alert">
              <strong>*** {restrictions.join("; ")} ***</strong>
              {overdue > 0 ? `CUSTOMER HAS ${overdue} OVERDUE RENTAL${overdue === 1 ? "" : "S"}. ` : ""}MANAGER OVERRIDE REQUIRED TO RENT TO THIS CUSTOMER. <Link href={`/customers/${c.id}`} style={{ color: "var(--yellow)" }}>VIEW ACCOUNT DETAILS</Link>
            </div>
          )}
          <CheckoutClient
            customerId={c.id} customerName={name} status={status} fees={c.outstandingFees.toFixed(2)}
            restrictions={restrictions} activeOut={activeOut} maxOut={maxOut} timezone={tz} saleCategories={store.concessionCategories.map((c) => ({ id: c.id, name: c.name }))} canOverride={role !== "EMPLOYEE"} taxPercent={store.settings!.salesTaxPercent.toString()}
          />
        </>
      )}
    </Screen>
  );
}

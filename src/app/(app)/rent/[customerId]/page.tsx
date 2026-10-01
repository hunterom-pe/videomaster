import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/CheckoutClient";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { rentAgainItems } from "@/lib/rent-again";
import { membershipState } from "@/lib/membership";
import { effectiveStatus, overdueCounts } from "@/lib/overdue";
import { toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "CUSTOMER CHECKOUT" };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<{ again?: string; againTx?: string }> }) {
  const { user, store, role } = await requireStore();
  const tz = store.settings!.timezone;
  const { customerId } = await params;
  const sp = await searchParams;
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

  // "Rent again": pre-fill the cart with available copies of the same titles and formats.
  const again = sp.again || sp.againTx ? await rentAgainItems(store.id, c.id, { rentalId: sp.again, transactionId: sp.againTx }) : null;
  const againNotice = again
    ? [
        again.found === 0 ? "NOTHING TO RENT AGAIN: THAT RENTAL WAS NOT FOUND." : null,
        again.items.length > 0 ? `${again.items.length} VIDEO${again.items.length === 1 ? "" : "S"} ADDED FROM THE PREVIOUS RENTAL. REMOVE ANY YOU DON'T WANT.` : null,
        again.missing.length > 0 ? `NO COPY AVAILABLE NOW: ${again.missing.join(", ")}.` : null,
      ].filter(Boolean).join(" ")
    : "";

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
              {overdue > 0 ? `CUSTOMER HAS ${overdue} OVERDUE RENTAL${overdue === 1 ? "" : "S"}. ` : ""}MANAGER OVERRIDE REQUIRED TO RENT TO THIS CUSTOMER. <Link href={`/customers/${c.id}`} style={{ color: "var(--alert-head)" }}>VIEW ACCOUNT DETAILS</Link>
            </div>
          )}
          <CheckoutClient
            customerId={c.id} customerName={name} status={status} fees={c.outstandingFees.toFixed(2)}
            key={`${sp.again ?? ""}${sp.againTx ?? ""}`} initialRentals={again?.items} initialNotice={againNotice}
            credit={toCents(c.storeCredit)} restrictions={restrictions} activeOut={activeOut} maxOut={maxOut} timezone={tz} saleCategories={store.concessionCategories.map((c) => ({ id: c.id, name: c.name }))} canOverride={role !== "EMPLOYEE"} taxPercent={store.settings!.salesTaxPercent.toString()}
          />
        </>
      )}
    </Screen>
  );
}

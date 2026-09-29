import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; edit?: string }>;
}) {
  const { user, store } = await requireStore();
  const { id } = await params;
  // Scoped by the session's store: another store's customer id is simply "not found".
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const { saved } = await searchParams;
  const activeRentals = await db.rental.count({ where: { storeId: store.id, customerId: c.id, returnedAt: null } });
  const fees = Number(c.outstandingFees);
  const address = [c.address, [c.city, c.region].filter(Boolean).join(", "), c.postalCode].filter(Boolean).join(" · ");

  return (
    <Screen title="CUSTOMER ACCOUNT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>{c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href={`/customers/${c.id}/edit`} className="vm-btn">[ EDIT ]</Link>
          <Link href="/customers" className="vm-btn">[ CUSTOMER SEARCH ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {saved && <div className="vm-notice" role="status">*** CUSTOMER SAVED ***</div>}
      {c.status !== "GOOD" && (
        <div className="vm-alert" role="alert">
          <strong>*** ACCOUNT {c.status} ***</strong>
          {c.status === "CLOSED" ? "THIS ACCOUNT IS CLOSED." : "MANAGER OVERRIDE REQUIRED FOR NEW RENTALS."}
        </div>
      )}
      {fees > 0 && <div className="vm-notice" role="status">OUTSTANDING BALANCE: ${fees.toFixed(2)}</div>}
      <fieldset className="vm-section">
        <legend>ACCOUNT</legend>
        <dl className="vm-kv">
          <dt>MEMBER #</dt><dd>{c.membershipNumber}</dd>
          <dt>STATUS</dt><dd><span className={`vm-status ${c.status}`}>{c.status}</span></dd>
          <dt>DATE JOINED</dt><dd>{c.createdAt.toISOString().slice(0, 10)}</dd>
          <dt>PHONE</dt><dd>{c.phone ?? "—"}</dd>
          <dt>E-MAIL</dt><dd>{c.email ?? "—"}</dd>
          <dt>ADDRESS</dt><dd>{address || "—"}</dd>
          <dt>DATE OF BIRTH</dt><dd>{c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : "—"}</dd>
          <dt>FEES DUE</dt><dd>${fees.toFixed(2)}</dd>
          <dt>NOTES</dt><dd style={{ whiteSpace: "pre-wrap" }}>{c.notes ?? "—"}</dd>
        </dl>
      </fieldset>
      <fieldset className="vm-section">
        <legend>ACTIVE RENTALS</legend>
        {activeRentals === 0 ? <span className="vm-dim">NO ACTIVE RENTALS</span> : <span>{activeRentals} VIDEO(S) OUT</span>}
        <div className="vm-hint">RENTAL AND PURCHASE HISTORY WILL APPEAR HERE ONCE RENTALS ARE INSTALLED.</div>
      </fieldset>
    </Screen>
  );
}

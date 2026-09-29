import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { accruedLateFeeCents, daysLate, startOfUtcDay } from "@/lib/late-fees";
import { effectiveStatus } from "@/lib/overdue";
import { fmtDate, fmtMoney, toCents } from "@/lib/pricing";
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
  const activeRentals = await db.rental.findMany({
    where: { storeId: store.id, customerId: c.id, returnedAt: null },
    orderBy: { dueAt: "asc" },
    include: { copy: { include: { movieTitle: true, rentalCategory: true } } },
  });
  const now = new Date();
  const cutoff = startOfUtcDay(now);
  const overdueRentals = activeRentals.filter((r) => r.dueAt < cutoff);
  const status = effectiveStatus(c.status, overdueRentals.length);
  const accruedCents = overdueRentals.reduce((n, r) => {
    const cat = r.copy.rentalCategory;
    return n + (cat ? accruedLateFeeCents(r.dueAt, now, toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null) : 0);
  }, 0);
  const fees = Number(c.outstandingFees);
  const address = [c.address, [c.city, c.region].filter(Boolean).join(", "), c.postalCode].filter(Boolean).join(" · ");

  return (
    <Screen title="CUSTOMER ACCOUNT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>{c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href={`/rent/${c.id}`} className="vm-btn">[ RENT VIDEO ]</Link>
          <Link href={`/customers/${c.id}/edit`} className="vm-btn">[ EDIT ]</Link>
          <Link href="/customers" className="vm-btn">[ CUSTOMER SEARCH ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {saved && <div className="vm-notice" role="status">*** CUSTOMER SAVED ***</div>}
      {overdueRentals.length > 0 && (
        <div className="vm-alert" role="alert">
          <strong>*** ACCOUNT OVERDUE ***</strong>
          CUSTOMER HAS {overdueRentals.length} OVERDUE RENTAL{overdueRentals.length === 1 ? "" : "S"}. ACCRUED LATE FEES: {fmtMoney(accruedCents)}
          <div>{status === "OVERDUE" ? "MANAGER OVERRIDE REQUIRED FOR NEW RENTALS." : ""}</div>
          <div className="vm-actions">
            {overdueRentals.slice(0, 3).map((r) => <Link key={r.id} href={`/return/${r.id}`} className="vm-btn small">[ RETURN {r.copy.copyNumber} ]</Link>)}
            <Link href="/overdue" className="vm-btn small">[ ALL OVERDUE RENTALS ]</Link>
          </div>
        </div>
      )}
      {status !== "GOOD" && status !== "OVERDUE" && (
        <div className="vm-alert" role="alert">
          <strong>*** ACCOUNT {status} ***</strong>
          {status === "CLOSED" ? "THIS ACCOUNT IS CLOSED." : "MANAGER OVERRIDE REQUIRED FOR NEW RENTALS."}
        </div>
      )}
      {fees > 0 && <div className="vm-notice" role="status">OUTSTANDING BALANCE: ${fees.toFixed(2)}</div>}
      <fieldset className="vm-section">
        <legend>ACCOUNT</legend>
        <dl className="vm-kv">
          <dt>MEMBER #</dt><dd>{c.membershipNumber}</dd>
          <dt>STATUS</dt><dd><span className={`vm-status ${status}`}>{status}</span></dd>
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
        {activeRentals.length === 0 ? (
          <span className="vm-dim">NO ACTIVE RENTALS</span>
        ) : (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 480 }}>
              <thead><tr><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">RENTED</th><th scope="col">DUE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {activeRentals.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/inventory/${r.copy.movieTitleId}`}>{r.copy.movieTitle.title.toUpperCase()}</Link></td>
                    <td>{r.copy.copyNumber}</td>
                    <td>{fmtDate(r.rentedAt)}</td>
                    <td>{fmtDate(r.dueAt)}</td>
                    <td>{r.dueAt < cutoff ? <span className="vm-red"><strong>{daysLate(r.dueAt, now)} DAY{daysLate(r.dueAt, now) === 1 ? "" : "S"} LATE</strong></span> : "OUT"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="vm-hint">RETURNS AND FULL RENTAL HISTORY ARE NOT INSTALLED YET.</div>
      </fieldset>
    </Screen>
  );
}

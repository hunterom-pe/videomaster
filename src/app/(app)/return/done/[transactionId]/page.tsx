import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { fmtDate } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_METHODS } from "@/lib/validation";

export default async function ReturnDonePage({ params }: { params: Promise<{ transactionId: string }> }) {
  const { user, store } = await requireStore();
  const { transactionId } = await params;
  const t = await db.transaction.findFirst({
    where: { id: transactionId, storeId: store.id, type: "RETURN" },
    include: { customer: true, returnedRentals: { include: { copy: { include: { movieTitle: true } } } } },
  });
  if (!t) notFound();
  const r = t.returnedRentals[0];

  return (
    <Screen title="RETURN COMPLETE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`} status="TRANSACTION COMPLETE">
      <div className="vm-notice" role="status">*** RETURN COMPLETE ***</div>
      <dl className="vm-kv">
        <dt>TRANSACTION #</dt><dd>{String(t.number).padStart(6, "0")}</dd>
        <dt>CUSTOMER</dt><dd>{t.customer ? `${t.customer.firstName} ${t.customer.lastName}`.toUpperCase() : "—"}</dd>
        {r && (
          <>
            <dt>MOVIE</dt><dd>{r.copy.movieTitle.title.toUpperCase()} — {FORMAT_LABELS[r.copy.format]} [{r.copy.copyNumber}]</dd>
            <dt>RENTED / DUE</dt><dd>{fmtDate(r.rentedAt)} / {fmtDate(r.dueAt)}</dd>
            <dt>RETURNED</dt><dd>{r.returnedAt ? fmtDate(r.returnedAt) : "—"}</dd>
            <dt>OUTCOME</dt><dd className={r.outcome === "RETURNED" ? "" : "vm-yellow"}>{r.outcome}</dd>
            <dt>LATE FEE</dt><dd>${r.chargedLateFee?.toFixed(2) ?? "0.00"} <span className="vm-dim">(CALCULATED ${r.calculatedLateFee?.toFixed(2) ?? "0.00"})</span></dd>
            {r.otherFee && <><dt>{r.outcome === "LOST" ? "LOST-ITEM FEE" : "DAMAGE FEE"}</dt><dd>${r.otherFee.toFixed(2)}</dd></>}
          </>
        )}
        <dt>TOTAL COLLECTED</dt><dd><strong>${t.total.toFixed(2)}</strong>{t.total.gt(0) ? ` — ${PAYMENT_METHODS.find((p) => p.value === t.paymentMethod)?.label}` : ""}</dd>
      </dl>
      {t.notes && <p className="vm-yellow">{t.notes}</p>}
      <p className="vm-cyan">PROCESSING COMPLETE. COPY STATUS UPDATED.</p>
      <div className="vm-actions">
        <Link href="/return" className="vm-btn">[ RETURN ANOTHER ]</Link>
        {t.customerId && <Link href={`/customers/${t.customerId}`} className="vm-btn">[ CUSTOMER ACCOUNT ]</Link>}
        <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
      </div>
    </Screen>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { fmtDate } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_METHODS } from "@/lib/validation";

export default async function RentalDonePage({ params }: { params: Promise<{ transactionId: string }> }) {
  const { user, store } = await requireStore();
  const { transactionId } = await params;
  const t = await db.transaction.findFirst({
    where: { id: transactionId, storeId: store.id },
    include: { customer: true, rentals: { orderBy: { rentedAt: "asc" }, include: { copy: { include: { movieTitle: true } } } } },
  });
  if (!t) notFound();

  return (
    <Screen title="TRANSACTION COMPLETE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`} status="TRANSACTION COMPLETE">
      <div className="vm-notice" role="status">*** TRANSACTION COMPLETE ***</div>
      <dl className="vm-kv">
        <dt>TRANSACTION #</dt><dd>{String(t.number).padStart(6, "0")}</dd>
        <dt>DATE</dt><dd>{t.createdAt.toISOString().slice(0, 10)}</dd>
        <dt>CUSTOMER</dt><dd>{t.customer ? `${t.customer.firstName} ${t.customer.lastName}`.toUpperCase() : "—"}</dd>
      </dl>
      <hr className="vm-thin-rule" />
      <div className="vm-tablewrap">
        <table className="vm-table" style={{ minWidth: 520 }}>
          <thead><tr><th scope="col">ITEM</th><th scope="col">PRICE</th><th scope="col">DUE</th></tr></thead>
          <tbody>
            {t.rentals.map((r) => (
              <tr key={r.id}>
                <td>{r.copy.movieTitle.title.toUpperCase()} — {FORMAT_LABELS[r.copy.format]} [{r.copy.copyNumber}]</td>
                <td>${r.price.toFixed(2)}</td>
                <td>{fmtDate(r.dueAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <hr className="vm-thin-rule" />
      <dl className="vm-kv">
        <dt>SUBTOTAL</dt><dd>${t.subtotal.toFixed(2)}</dd>
        <dt>TAX</dt><dd>${t.tax.toFixed(2)}</dd>
        <dt>TOTAL</dt><dd><strong>${t.total.toFixed(2)}</strong></dd>
        <dt>PAID BY</dt><dd>{PAYMENT_METHODS.find((p) => p.value === t.paymentMethod)?.label}</dd>
      </dl>
      <p className="vm-cyan">PLEASE REWIND. THANK YOU!</p>
      <div className="vm-actions">
        <Link href="/rent" className="vm-btn">[ NEW RENTAL ]</Link>
        {t.customerId && <Link href={`/customers/${t.customerId}`} className="vm-btn">[ CUSTOMER ACCOUNT ]</Link>}
        <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
      </div>
    </Screen>
  );
}

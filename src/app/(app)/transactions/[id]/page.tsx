import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { fmtDate } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_LABELS, TYPE_LABELS } from "@/lib/transactions";

const rentalInclude = { copy: { include: { movieTitle: true } } } as const;

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const { id } = await params;
  const t = await db.transaction.findFirst({
    where: { id, storeId: store.id },
    include: {
      customer: true,
      createdBy: { select: { email: true } },
      items: { orderBy: { description: "asc" } },
      rentals: { orderBy: { rentedAt: "asc" }, include: rentalInclude },
      returnedRentals: { orderBy: { returnedAt: "asc" }, include: rentalInclude },
    },
  });
  if (!t) notFound();
  const number = String(t.number).padStart(6, "0");

  return (
    <Screen title="TRANSACTION DETAIL" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>TRANSACTION #{number}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href={`/receipt/${t.id}`} className="vm-btn">[ RECEIPT ]</Link>
          <Link href="/transactions" className="vm-btn">[ TRANSACTION HISTORY ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      <fieldset className="vm-section">
        <legend>SUMMARY</legend>
        <dl className="vm-kv">
          <dt>TYPE</dt><dd>{TYPE_LABELS[t.type]}</dd>
          <dt>DATE / TIME</dt><dd>{t.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
          <dt>CUSTOMER</dt><dd>{t.customer ? <Link href={`/customers/${t.customer.id}`}>{t.customer.firstName.toUpperCase()} {t.customer.lastName.toUpperCase()} (#{t.customer.membershipNumber})</Link> : "WALK-IN"}</dd>
          <dt>EMPLOYEE</dt><dd>{t.createdBy?.email ?? "—"}</dd>
          <dt>PAID BY</dt><dd>{PAYMENT_LABELS[t.paymentMethod]}</dd>
          {t.notes && (<><dt>NOTES</dt><dd className="vm-yellow">{t.notes}</dd></>)}
        </dl>
      </fieldset>

      {t.rentals.length > 0 && (
        <fieldset className="vm-section">
          <legend>RENTALS</legend>
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 560 }}>
              <thead><tr><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">PRICE</th><th scope="col">DUE</th><th scope="col">STATUS</th></tr></thead>
              <tbody>
                {t.rentals.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/inventory/${r.copy.movieTitleId}`}>{r.copy.movieTitle.title.toUpperCase()}</Link> <span className="vm-dim">{FORMAT_LABELS[r.copy.format]}</span></td>
                    <td>{r.copy.copyNumber}</td>
                    <td>${r.price.toFixed(2)}</td>
                    <td>{fmtDate(r.dueAt)}</td>
                    <td>{r.returnedAt ? `RETURNED ${fmtDate(r.returnedAt)}${r.outcome && r.outcome !== "RETURNED" ? ` (${r.outcome})` : ""}` : "OUT"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}

      {t.returnedRentals.length > 0 && (
        <fieldset className="vm-section">
          <legend>RETURNED ITEMS</legend>
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 640 }}>
              <thead><tr><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">OUTCOME</th><th scope="col">LATE FEE (CALC / CHARGED)</th><th scope="col">OTHER FEE</th></tr></thead>
              <tbody>
                {t.returnedRentals.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/inventory/${r.copy.movieTitleId}`}>{r.copy.movieTitle.title.toUpperCase()}</Link></td>
                    <td>{r.copy.copyNumber}</td>
                    <td className={r.outcome === "RETURNED" ? "" : "vm-yellow"}>{r.outcome}</td>
                    <td>${r.calculatedLateFee?.toFixed(2) ?? "0.00"} / ${r.chargedLateFee?.toFixed(2) ?? "0.00"}</td>
                    <td>{r.otherFee ? `$${r.otherFee.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}

      {t.items.length > 0 && (
        <fieldset className="vm-section">
          <legend>MERCHANDISE</legend>
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 520 }}>
              <thead><tr><th scope="col">SKU</th><th scope="col">ITEM</th><th scope="col">QTY</th><th scope="col">UNIT</th><th scope="col">LINE TOTAL</th></tr></thead>
              <tbody>
                {t.items.map((i) => (
                  <tr key={i.id}><td>{i.sku}</td><td>{i.description.toUpperCase()}{i.taxable ? "" : " (NO TAX)"}</td><td>{i.quantity}</td><td>${i.unitPrice.toFixed(2)}</td><td>${i.lineTotal.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}

      <fieldset className="vm-section">
        <legend>TOTALS</legend>
        <dl className="vm-kv">
          <dt>SUBTOTAL</dt><dd>${t.subtotal.toFixed(2)}</dd>
          <dt>TAX</dt><dd>${t.tax.toFixed(2)}</dd>
          <dt>TOTAL</dt><dd><strong>${t.total.toFixed(2)}</strong></dd>
        </dl>
      </fieldset>
    </Screen>
  );
}

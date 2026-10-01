import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { fmtDate } from "@/lib/pricing";
import { fmtDateTimeTz, tzAbbrev } from "@/lib/tz";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_LABELS, TYPE_LABELS } from "@/lib/transactions";
import { refundability, voidBlocker, originalInclude } from "@/lib/transaction-ops";

export const metadata = { title: "TRANSACTION DETAIL" };

const rentalInclude = { copy: { include: { movieTitle: true } } } as const;
const money = (n: { toFixed(d: number): string } | number) => (Number(n) < 0 ? `-$${Math.abs(Number(n)).toFixed(2)}` : `$${Number(n).toFixed(2)}`);
const num = (n: number) => String(n).padStart(6, "0");

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store, role } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const t = await db.transaction.findFirst({
    where: { id, storeId: store.id },
    include: {
      customer: true,
      createdBy: { select: { email: true } },
      items: { orderBy: { description: "asc" } },
      rentals: { orderBy: { rentedAt: "asc" }, include: rentalInclude },
      returnedRentals: { orderBy: { returnedAt: "asc" }, include: rentalInclude },
      voidedBy: { select: { email: true } },
      refundOf: { select: { id: true, number: true } },
      refunds: { orderBy: { number: "asc" }, select: { id: true, number: true, total: true, createdAt: true, voidedAt: true } },
    },
  });
  if (!t) notFound();
  // Void / refund eligibility (manager-only). Uses the same rules as the server actions.
  const full = role === "EMPLOYEE" ? null : await db.transaction.findFirst({ where: { id: t.id, storeId: store.id }, include: originalInclude });
  const canVoid = !!full && voidBlocker(full) === null;
  const canRefund = !!full && refundability(full).anything;
  const number = String(t.number).padStart(6, "0");

  return (
    <Screen title="TRANSACTION DETAIL" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>TRANSACTION #{number}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <Link href={`/receipt/${t.id}`} className="vm-btn">[ RECEIPT ]</Link>
          {canRefund && <Link href={`/transactions/${t.id}/refund`} className="vm-btn">[ REFUND ]</Link>}
          {canVoid && <Link href={`/transactions/${t.id}/void`} className="vm-btn danger">[ VOID ]</Link>}
          <Link href="/transactions" className="vm-btn">[ TRANSACTION HISTORY ]</Link>
        </span>
      </div>
      <hr className="vm-rule" />
      {t.voidedAt && (
        <div className="vm-notice" role="status">
          *** VOIDED {fmtDateTimeTz(t.voidedAt, tz)} BY {t.voidedBy?.email ?? "—"}: {t.voidReason} ***
          {t.voidSnapshot && <div className="vm-dim">WAS: {t.voidSnapshot}</div>}
        </div>
      )}
      <fieldset className="vm-section">
        <legend>SUMMARY</legend>
        <dl className="vm-kv">
          <dt>TYPE</dt><dd>{TYPE_LABELS[t.type]}</dd>
          <dt>DATE / TIME</dt><dd>{fmtDateTimeTz(t.createdAt, tz)} {tzAbbrev(tz, t.createdAt)}</dd>
          <dt>CUSTOMER</dt><dd>{t.customer ? <Link href={`/customers/${t.customer.id}`}>{t.customer.firstName.toUpperCase()} {t.customer.lastName.toUpperCase()} (#{t.customer.membershipNumber})</Link> : "WALK-IN"}</dd>
          <dt>EMPLOYEE</dt><dd>{t.createdBy?.email ?? "—"}</dd>
          <dt>PAID BY</dt><dd>{PAYMENT_LABELS[t.paymentMethod]}</dd>
          {t.refundOf && (<><dt>REFUND OF</dt><dd><Link href={`/transactions/${t.refundOf.id}`}>#{num(t.refundOf.number)}</Link></dd></>)}
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
                    <td>${r.price.toFixed(2)}{r.refundedAt && <span className="vm-yellow"> (REFUNDED)</span>}</td>
                    <td>{fmtDate(r.dueAt, tz)}</td>
                    <td>{r.returnedAt ? `RETURNED ${fmtDate(r.returnedAt, tz)}${r.outcome && r.outcome !== "RETURNED" ? ` (${r.outcome})` : ""}` : "OUT"}</td>
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
              <thead><tr><th scope="col">TITLE</th><th scope="col">COPY</th><th scope="col">OUTCOME</th><th scope="col">LATE FEE (CALC / CHARGED)</th><th scope="col">OTHER FEE</th><th scope="col">REWIND FEE</th></tr></thead>
              <tbody>
                {t.returnedRentals.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/inventory/${r.copy.movieTitleId}`}>{r.copy.movieTitle.title.toUpperCase()}</Link></td>
                    <td>{r.copy.copyNumber}</td>
                    <td className={r.outcome === "RETURNED" ? "" : "vm-yellow"}>{r.outcome}</td>
                    <td>${r.calculatedLateFee?.toFixed(2) ?? "0.00"} / ${r.chargedLateFee?.toFixed(2) ?? "0.00"}</td>
                    <td>{r.otherFee ? `$${r.otherFee.toFixed(2)}` : "—"}</td>
                    <td>{r.rewindFee ? `$${r.rewindFee.toFixed(2)}` : "—"}</td>
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
                  <tr key={i.id}><td>{i.sku}</td><td>{i.description.toUpperCase()}{i.taxable ? "" : " (NO TAX)"}{i.refundedQty > 0 && <span className="vm-yellow"> ({i.refundedQty} REFUNDED)</span>}</td><td>{i.quantity}</td><td>{money(i.unitPrice)}</td><td>{money(i.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}

      <fieldset className="vm-section">
        <legend>TOTALS</legend>
        <dl className="vm-kv">
          <dt>SUBTOTAL</dt><dd>{money(t.subtotal)}</dd>
          <dt>TAX</dt><dd>{money(t.tax)}</dd>
          <dt>TOTAL</dt><dd><strong>{money(t.total)}</strong></dd>
          {Number(t.balanceChange) !== 0 && (<><dt>{Number(t.balanceChange) > 0 ? "PUT ON ACCOUNT" : "ACCOUNT BALANCE REDUCED"}</dt><dd>{money(Math.abs(Number(t.balanceChange)))}</dd></>)}
          {Number(t.creditChange) !== 0 && (<><dt>{Number(t.creditChange) > 0 ? "STORE CREDIT ADDED" : "STORE CREDIT USED"}</dt><dd>{money(Math.abs(Number(t.creditChange)))}</dd></>)}
          {t.tendered && (<><dt>CASH TENDERED</dt><dd>{money(t.tendered)}</dd><dt>CHANGE GIVEN</dt><dd>{money(Number(t.tendered) - Number(t.total))}</dd></>)}
        </dl>
      </fieldset>

      {t.refunds.length > 0 && (
        <fieldset className="vm-section">
          <legend>REFUNDS AGAINST THIS TRANSACTION</legend>
          <ul className="vm-plain">
            {t.refunds.map((r) => (
              <li key={r.id}><Link href={`/transactions/${r.id}`}>#{num(r.number)}</Link> — {fmtDateTimeTz(r.createdAt, tz)} — {money(r.total)}</li>
            ))}
          </ul>
        </fieldset>
      )}
    </Screen>
  );
}

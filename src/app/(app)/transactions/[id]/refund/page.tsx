import Link from "next/link";
import { notFound } from "next/navigation";
import { RefundForm } from "@/components/RefundForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { loadOriginal, refundability } from "@/lib/transaction-ops";

export const metadata = { title: "REFUND" };

export default async function RefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store, role } = await requireStore();
  const { id } = await params;
  const t = await loadOriginal(db, store.id, id);
  if (!t) notFound();
  const number = String(t.number).padStart(6, "0");
  const can = refundability(t);
  const blocker = role === "EMPLOYEE" ? "ONLY AN OWNER OR MANAGER CAN ISSUE A REFUND." : t.voidedAt ? "THIS TRANSACTION IS VOIDED." : !can.anything ? "NOTHING ON THIS TRANSACTION CAN BE REFUNDED (OR IT HAS ALREADY BEEN REFUNDED IN FULL)." : null;

  // Which merchandise lines can go back to stock: the product must still exist.
  const itemIds = new Map(t.items.map((i) => [i.id, i.concessionItemId]));

  return (
    <Screen title="REFUND" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>REFUND — TRANSACTION #{number}</h1>
      <hr className="vm-rule" />
      {blocker ? (
        <>
          <p className="vm-yellow">{blocker}</p>
          <div className="vm-actions"><Link href={`/transactions/${t.id}`} className="vm-btn">[ BACK ]</Link></div>
        </>
      ) : (
        <RefundForm
          transactionId={t.id}
          number={number}
          defaultMethod={t.paymentMethod}
          merchandise={can.merchandise.map((m) => ({ ...m, canRestock: !!itemIds.get(m.id) }))}
          rentals={can.rentals.map((r) => ({ id: r.id, label: r.label, cents: r.cents, taxable: r.taxable, returned: r.returned }))}
          fee={can.fee}
          originalTaxCents={can.originalTaxCents}
          originalTaxableBaseCents={can.originalTaxableBaseCents}
          remainingTaxCents={can.remainingTaxCents}
        />
      )}
    </Screen>
  );
}

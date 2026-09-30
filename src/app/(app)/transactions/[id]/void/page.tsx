import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
import { VoidForm } from "@/components/VoidForm";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";
import { loadOriginal, voidBlocker } from "@/lib/transaction-ops";
import { fmtMoney, toCents } from "@/lib/pricing";

export const metadata = { title: "VOID TRANSACTION" };

export default async function VoidPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store, role } = await requireStore();
  const { id } = await params;
  const t = await loadOriginal(db, store.id, id);
  if (!t) notFound();
  const number = String(t.number).padStart(6, "0");
  const blocker = role === "EMPLOYEE" ? "ONLY AN OWNER OR MANAGER CAN VOID A TRANSACTION." : voidBlocker(t);

  return (
    <Screen title="VOID TRANSACTION" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>VOID TRANSACTION #{number}</h1>
      <hr className="vm-rule" />
      {blocker ? (
        <>
          <p className="vm-yellow">{blocker}</p>
          <div className="vm-actions"><Link href={`/transactions/${t.id}`} className="vm-btn">[ BACK ]</Link></div>
        </>
      ) : (
        <>
          <p>VOIDING CANCELS THIS TRANSACTION AS IF IT NEVER HAPPENED ({fmtMoney(toCents(t.total))}).</p>
          <ul className="vm-plain">
            {t.rentals.length > 0 && <li>{t.rentals.length} RENTAL(S) ARE REMOVED AND THE VIDEOS GO BACK ON THE SHELF.</li>}
            {t.items.length > 0 && <li>MERCHANDISE IS RESTOCKED.</li>}
            <li>THE TRANSACTION STAYS IN HISTORY, MARKED VOID, AND IS LEFT OUT OF ALL TOTALS.</li>
          </ul>
          <VoidForm transactionId={t.id} number={number} />
        </>
      )}
    </Screen>
  );
}

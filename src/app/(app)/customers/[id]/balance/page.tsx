import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceForm } from "@/components/BalanceForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { fmtMoney, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "ACCOUNT BALANCE" };

export default async function BalancePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store, role } = await requireStore();
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const balance = toCents(c.outstandingFees);
  const recent = await db.transaction.findMany({
    where: { storeId: store.id, customerId: c.id, voidedAt: null, balanceChange: { not: 0 } },
    orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, type: true, createdAt: true, balanceChange: true, notes: true },
  });

  return (
    <Screen title="ACCOUNT BALANCE" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>ACCOUNT BALANCE — {c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</h1>
      <hr className="vm-rule" />
      {balance <= 0 ? (
        <>
          <p>NO BALANCE DUE ON THIS ACCOUNT.</p>
          <div className="vm-actions"><Link href={`/customers/${c.id}`} className="vm-btn">[ BACK ]</Link></div>
        </>
      ) : (
        <>
          <dl className="vm-kv"><dt>BALANCE DUE</dt><dd><strong className="vm-red">{fmtMoney(balance)}</strong></dd></dl>
          <BalanceForm customerId={c.id} balanceCents={balance} canWaive={role !== "EMPLOYEE"} creditCents={toCents(c.storeCredit)} />
        </>
      )}
      {recent.length > 0 && (
        <fieldset className="vm-section">
          <legend>RECENT ACCOUNT ACTIVITY</legend>
          <ul className="vm-plain">
            {recent.map((t) => (
              <li key={t.id}><Link href={`/transactions/${t.id}`}>#{String(t.number).padStart(6, "0")}</Link> — {t.createdAt.toISOString().slice(0, 10)} — {Number(t.balanceChange) > 0 ? "PUT ON ACCOUNT +" : "REDUCED -"}${Math.abs(Number(t.balanceChange)).toFixed(2)}</li>
            ))}
          </ul>
        </fieldset>
      )}
    </Screen>
  );
}

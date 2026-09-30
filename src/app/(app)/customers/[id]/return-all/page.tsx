import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnAllForm } from "@/components/ReturnAllForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/pricing";
import { lateFeeFor, openRentalsFor } from "@/lib/returns-batch";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "RETURN ALL" };

export default async function ReturnAllPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const open = await openRentalsFor(db, store.id, c.id);
  const now = new Date();
  const rows = open.map((r) => {
    const fee = lateFeeFor(r, now, tz);
    return { id: r.id, title: r.copy.movieTitle.title.toUpperCase(), copyNumber: r.copy.copyNumber, dueLabel: fmtDate(r.dueAt, tz), days: fee.days, lateCents: fee.calcCents };
  });

  return (
    <Screen title="RETURN ALL" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>RETURN ALL — {c.lastName.toUpperCase()}, {c.firstName.toUpperCase()}</h1>
        <Link href={`/customers/${c.id}`} className="vm-btn">[ ACCOUNT ]</Link>
      </div>
      <hr className="vm-rule" />
      {rows.length === 0 ? (
        <>
          <div className="vm-notice" role="status">*** THIS CUSTOMER HAS NO VIDEOS OUT ***</div>
          <div className="vm-actions"><Link href={`/customers/${c.id}`} className="vm-btn">[ BACK ]</Link></div>
        </>
      ) : (
        <ReturnAllForm customerId={c.id} rows={rows} />
      )}
    </Screen>
  );
}

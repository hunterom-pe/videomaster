import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnClient } from "@/components/ReturnClient";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { daysLate, lateFeeCents } from "@/lib/late-fees";
import { fmtDate, fmtMoney, fromCents, toCents } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export default async function ReturnDetailPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { user, store } = await requireStore();
  const { rentalId } = await params;
  const r = await db.rental.findFirst({
    where: { id: rentalId, storeId: store.id },
    include: { customer: true, copy: { include: { movieTitle: true, rentalCategory: true } } },
  });
  if (!r) notFound();

  if (r.returnedAt) {
    return (
      <Screen title="RETURN VIDEO" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
        <div className="vm-notice" role="status">*** THIS VIDEO WAS ALREADY RETURNED ON {r.returnedAt.toISOString().slice(0, 10)} ***</div>
        <div className="vm-actions"><Link href="/return" className="vm-btn">[ RETURN VIDEO ]</Link></div>
      </Screen>
    );
  }

  const now = new Date();
  const late = daysLate(r.dueAt, now);
  const cat = r.copy.rentalCategory;
  const calc = cat ? lateFeeCents(late, toCents(cat.lateFeePerDay), cat.maxLateFee ? toCents(cat.maxLateFee) : null) : 0;
  const settings = store.settings!;
  const replacement = cat?.replacementBehavior === "NONE" ? 0 : toCents(r.copy.replacementCost ?? 0);
  const lostFee = replacement + toCents(settings.lostItemFee); // replacement cost plus optional lost-item fee

  return (
    <Screen title="RETURN VIDEO" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>RETURN VIDEO</h1>
        <Link href="/return" className="vm-btn">[ BACK ]</Link>
      </div>
      <hr className="vm-rule" />
      {late > 0 && <div className="vm-alert" role="alert"><strong>*** VIDEO IS {late} DAY{late === 1 ? "" : "S"} LATE ***</strong>LATE FEE PER STORE POLICY: {fmtMoney(calc)}</div>}
      <fieldset className="vm-section">
        <legend>RENTAL</legend>
        <dl className="vm-kv">
          <dt>MOVIE</dt><dd>{r.copy.movieTitle.title.toUpperCase()}{r.copy.movieTitle.year ? ` (${r.copy.movieTitle.year})` : ""}</dd>
          <dt>COPY</dt><dd>{r.copy.copyNumber} — {FORMAT_LABELS[r.copy.format]}</dd>
          <dt>CUSTOMER</dt><dd><Link href={`/customers/${r.customerId}`}>{r.customer.firstName.toUpperCase()} {r.customer.lastName.toUpperCase()}</Link></dd>
          <dt>RENTED</dt><dd>{fmtDate(r.rentedAt)}</dd>
          <dt>DUE</dt><dd>{fmtDate(r.dueAt)}</dd>
          <dt>RETURNED</dt><dd>{fmtDate(now)}</dd>
          <dt>DAYS LATE</dt><dd className={late > 0 ? "vm-red" : ""}>{late}</dd>
          <dt>LATE FEE</dt><dd>{fmtMoney(calc)}{cat ? ` (${fmtMoney(toCents(cat.lateFeePerDay))}/DAY${cat.maxLateFee ? `, MAX ${fmtMoney(toCents(cat.maxLateFee))}` : ""})` : " (NO CATEGORY — NO POLICY)"}</dd>
        </dl>
      </fieldset>
      <ReturnClient rentalId={r.id} calculated={fromCents(calc)} lostFee={fromCents(lostFee)} damageFee={settings.damageFee.toFixed(2)} rewindFee={settings.rewindFee.toFixed(2)} isVhs={r.copy.format === "VHS"} />
    </Screen>
  );
}

import { notFound } from "next/navigation";
import { RenewForm } from "@/components/RenewForm";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { fmtDateUS } from "@/lib/pricing";
import { renewedExpiry } from "@/lib/membership";
import { requireStore } from "@/lib/store-access";

export default async function RenewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const s = store.settings!;
  const next = renewedExpiry(c.membershipExpiresAt, new Date(), s.membershipTermMonths);
  return (
    <Screen title="RENEW MEMBERSHIP" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>RENEW MEMBERSHIP — {c.firstName.toUpperCase()} {c.lastName.toUpperCase()}</h1>
      <div className="vm-cyan">MEMBER #{c.membershipNumber}</div>
      <hr className="vm-rule" />
      <dl className="vm-kv" style={{ marginBottom: 12 }}>
        <dt>MEMBERSHIP FEE</dt><dd>${s.membershipFee.toFixed(2)}</dd>
        <dt>TERM</dt><dd>{s.membershipTermMonths > 0 ? `${s.membershipTermMonths} MONTH${s.membershipTermMonths === 1 ? "" : "S"}` : "NEVER EXPIRES"}</dd>
        <dt>CURRENT EXPIRY</dt><dd>{c.membershipExpiresAt ? fmtDateUS(c.membershipExpiresAt) : "—"}</dd>
        <dt>NEW EXPIRY</dt><dd>{next ? fmtDateUS(next) : "NEVER"}</dd>
      </dl>
      <RenewForm customerId={c.id} fee={s.membershipFee.toFixed(2)} />
    </Screen>
  );
}

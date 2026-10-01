import Link from "next/link";
import { StaffManager } from "@/components/StaffManager";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { fmtDateUS } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "STAFF ACCOUNTS" };

export default async function StaffPage() {
  const { user, store, role } = await requireStore();
  const tz = store.settings!.timezone;
  const members = role === "OWNER"
    ? await db.storeMember.findMany({ where: { storeId: store.id, role: { not: "OWNER" } }, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true } } } })
    : [];

  return (
    <Screen title="STAFF ACCOUNTS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>STAFF ACCOUNTS</h1>
        <Link href="/settings" className="vm-btn">[ STORE SETTINGS ]</Link>
      </div>
      <hr className="vm-rule" />
      {role !== "OWNER" ? (
        <div className="vm-notice" role="status">*** ONLY THE STORE OWNER CAN MANAGE STAFF ACCOUNTS ***</div>
      ) : (
        <>
          <fieldset className="vm-section">
            <legend>WHAT EACH ROLE CAN DO</legend>
            <dl className="vm-kv">
              <dt>OWNER</dt><dd>EVERYTHING, INCLUDING STAFF ACCOUNTS AND CLEARING STORE DATA (YOU)</dd>
              <dt>MANAGER</dt><dd>RENT, RETURN, SELL, CUSTOMERS, INVENTORY; ALSO MANAGER OVERRIDES, VOIDS, REFUNDS, WAIVING FEES AND BALANCES, STORE SETTINGS AND DATA EXPORT</dd>
              <dt>EMPLOYEE</dt><dd>RENT, RETURN, SELL, CUSTOMERS, INVENTORY. NO OVERRIDES, VOIDS, REFUNDS, WAIVERS, SETTINGS OR EXPORT</dd>
            </dl>
          </fieldset>
          <StaffManager staff={members.map((m) => ({ id: m.id, email: m.user.email, role: m.role, since: fmtDateUS(m.createdAt, tz) }))} />
        </>
      )}
    </Screen>
  );
}

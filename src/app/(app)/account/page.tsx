import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "MY ACCOUNT" };

export default async function AccountPage() {
  const { user, store, role } = await requireStore();
  return (
    <Screen title="MY ACCOUNT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <h1>MY ACCOUNT</h1>
      <hr className="vm-rule" />
      <dl className="vm-kv">
        <dt>E-MAIL</dt><dd>{user.email}</dd>
        <dt>ROLE</dt><dd>{role}</dd>
        <dt>STORE</dt><dd>{store.name} #{store.number}</dd>
      </dl>
      {user.isDemo ? (
        <div className="vm-notice" role="status">*** DEMO ACCOUNTS HAVE NO PASSWORD ***</div>
      ) : (
        <fieldset className="vm-section"><legend>CHANGE PASSWORD</legend><AccountForm /></fieldset>
      )}
      {role === "OWNER" && <div className="vm-actions"><Link href="/settings/staff" className="vm-btn">[ STAFF ACCOUNTS ]</Link></div>}
    </Screen>
  );
}

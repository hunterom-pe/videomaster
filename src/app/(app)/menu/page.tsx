import Link from "next/link";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { requireStore } from "@/lib/store-access";

const ITEMS = [
  { key: "F1", label: "RENT VIDEO" },
  { key: "F2", label: "RETURN VIDEO" },
  { key: "F3", label: "CUSTOMERS" },
  { key: "F4", label: "MOVIE INVENTORY" },
  { key: "F5", label: "CONCESSIONS" },
  { key: "F6", label: "OVERDUE RENTALS" },
  { key: "F7", label: "TRANSACTIONS" },
  { key: "F8", label: "REPORTS" },
];

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { user, store } = await requireStore();
  const { saved } = await searchParams;
  const [videosOut, customers] = await Promise.all([
    db.rental.count({ where: { storeId: store.id, returnedAt: null } }),
    db.customer.count({ where: { storeId: store.id } }),
  ]);

  return (
    <Screen title="MAIN MENU" userEmail={user.email} storeLine={`STORE #${store.number}`}>
      <div className="vm-center">
        <h1 className="vm-brand">VIDEOMASTER</h1>
        <div className="vm-cyan">VIDEO RENTAL MANAGEMENT SYSTEM</div>
        <div className="vm-dim">VERSION 1.0</div>
        <p style={{ margin: "12px 0 0" }}>STORE: {store.name} #{store.number}</p>
        {store.slogan && <div className="vm-cyan">&quot;{store.slogan}&quot;</div>}
      </div>
      <hr className="vm-rule" />
      {saved && <div className="vm-notice" role="status">*** STORE SETTINGS SAVED ***</div>}
      <div className="vm-menu">
        {ITEMS.map((i) => (
          <button key={i.label} type="button" className="vm-btn" disabled>
            <span className="fkey">[{i.key}]</span>{i.label}
            <small>NOT YET INSTALLED</small>
          </button>
        ))}
        <Link href="/settings" className="vm-btn" style={{ minHeight: 52, fontSize: 17 }}>
          <span className="fkey">[F9]</span>STORE SETTINGS
          <small>EDIT STORE INFORMATION AND POLICIES</small>
        </Link>
      </div>
      <hr className="vm-rule" />
      <div className="vm-cyan">
        VIDEOS OUT: {videosOut} &nbsp;&nbsp; CUSTOMERS: {customers}
      </div>
    </Screen>
  );
}

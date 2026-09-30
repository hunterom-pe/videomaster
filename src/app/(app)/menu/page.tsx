import Link from "next/link";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { overdueWhere } from "@/lib/overdue";
import { keyForPath } from "@/lib/function-keys";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "MAIN MENU" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ saved?: string; sample?: string; cleared?: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { saved, sample, cleared } = await searchParams;
  const [videosOut, customers, lowStock, overdueCount] = await Promise.all([
    db.rental.count({ where: { storeId: store.id, returnedAt: null } }),
    db.customer.count({ where: { storeId: store.id } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "ConcessionItem" WHERE "storeId" = ${store.id} AND active AND "quantityOnHand" <= "lowStockThreshold"`,
    db.rental.count({ where: overdueWhere(store.id, tz) }),
  ]);
  const lowCount = Number(lowStock[0]?.n ?? 0);

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
      {user.isDemo && <div className="vm-notice" role="status">*** DEMO MODE: THIS IS YOUR OWN PRIVATE PRACTICE STORE. CHANGE ANYTHING YOU LIKE. IT IS DELETED AFTER 24 HOURS. ***</div>}
      {saved && <div className="vm-notice" role="status">*** STORE SETTINGS SAVED ***</div>}
      {sample && <div className="vm-notice" role="status">*** SAMPLE STORE DATA LOADED. EXPLORE THE MENU BELOW. ***</div>}
      {cleared && <div className="vm-notice" role="status">*** ALL STORE DATA CLEARED ***</div>}
      <div className="vm-menu">
        <Link href="/rent" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/rent")}]</span>RENT VIDEO
          <small>CHECK OUT VIDEOS TO A CUSTOMER</small>
        </Link>
        <Link href="/return" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/return")}]</span>RETURN VIDEO
          <small>RETURN A RENTED VIDEO, LATE FEES</small>
        </Link>
        <Link href="/customers" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/customers")}]</span>CUSTOMERS
          <small>SEARCH, ADD AND EDIT MEMBERS</small>
        </Link>
        <Link href="/inventory" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/inventory")}]</span>MOVIE INVENTORY
          <small>TITLES, COPIES AND MOVIE SEARCH</small>
        </Link>
        <Link href="/concessions" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/concessions")}]</span>CONCESSIONS
          <small>CANDY, POPCORN, DRINKS AND STOCK</small>
        </Link>
        <Link href="/overdue" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/overdue")}]</span>OVERDUE RENTALS
          <small>{overdueCount > 0 ? `*** ${overdueCount} OVERDUE ***` : "NONE OVERDUE"}</small>
        </Link>
        <Link href="/transactions" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/transactions")}]</span>TRANSACTIONS
          <small>RENTALS, RETURNS AND SALES HISTORY</small>
        </Link>
        <Link href="/reports" className="vm-btn" style={{ minHeight: 56, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/reports")}]</span>REPORTS
          <small>ACTIVITY, INVENTORY, REVENUE AND MORE</small>
        </Link>
        <Link href="/settings" className="vm-btn" style={{ minHeight: 52, fontSize: 17 }}>
          <span className="fkey">[{keyForPath("/settings")}]</span>STORE SETTINGS
          <small>EDIT STORE INFORMATION AND POLICIES</small>
        </Link>
      </div>
      <hr className="vm-rule" />
      <div className="vm-cyan">
        VIDEOS OUT: {videosOut} &nbsp;&nbsp; <span className={overdueCount > 0 ? "vm-red" : ""}>OVERDUE: {overdueCount}</span> &nbsp;&nbsp; CUSTOMERS: {customers}
      </div>
      {lowCount > 0 && (
        <div className="vm-yellow" style={{ marginTop: 6 }}>
          <Link href="/concessions" style={{ color: "inherit" }}>*** LOW INVENTORY: {lowCount} MERCHANDISE ITEM{lowCount === 1 ? "" : "S"} NEED RESTOCKING ***</Link>
        </div>
      )}
      <div className="vm-dim" style={{ marginTop: 6 }}>FUNCTION KEYS: {store.settings!.functionKeys ? "ON (F1-F9)" : "OFF (TURN ON IN STORE SETTINGS)"}</div>
    </Screen>
  );
}

import Link from "next/link";
import { Screen } from "@/components/Screen";
import { requireStore } from "@/lib/store-access";
import { tzAbbrev } from "@/lib/tz";

export const metadata = { title: "REPORTS" };

export const REPORTS = [
  { slug: "daily", title: "DAILY ACTIVITY", desc: "RENTALS, RETURNS, MERCHANDISE SALES, LATE FEES, REVENUE AND TRANSACTIONS FOR ONE DAY" },
  { slug: "overdue", title: "OVERDUE RENTALS", desc: "EVERY OVERDUE VIDEO WITH DAYS OVERDUE AND CURRENT LATE FEE" },
  { slug: "inventory", title: "INVENTORY", desc: "TITLES AND COPIES: AVAILABLE, RENTED, OVERDUE, DAMAGED, LOST" },
  { slug: "popular", title: "POPULAR RENTALS", desc: "TITLES RANKED BY NUMBER OF RENTALS" },
  { slug: "customers", title: "CUSTOMER ACTIVITY", desc: "TOP CUSTOMERS BY NUMBER OF RENTALS" },
  { slug: "balances", title: "CUSTOMER BALANCES", desc: "CUSTOMERS WHO OWE FEES PUT ON ACCOUNT, LARGEST FIRST" },
  { slug: "merchandise", title: "MERCHANDISE INVENTORY", desc: "QUANTITY ON HAND, LOW STOCK AND OUT OF STOCK" },
  { slug: "revenue", title: "REVENUE", desc: "RENTAL, MERCHANDISE, FEES, TAXES AND TOTAL FOR A DATE RANGE" },
] as const;

export default async function ReportsPage() {
  const { user, store } = await requireStore();
  return (
    <Screen title="REPORTS" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>REPORTS</h1>
        <Link href="/menu" className="vm-btn">[ MAIN MENU ]</Link>
      </div>
      <hr className="vm-rule" />
      <div className="vm-menu" style={{ maxWidth: 900 }}>
        {REPORTS.map((r, i) => (
          <Link key={r.slug} href={`/reports/${r.slug}`} className="vm-btn" style={{ minHeight: 64 }}>
            <span className="fkey">[{i + 1}]</span>{r.title}
            <small>{r.desc}</small>
          </Link>
        ))}
      </div>
      <p className="vm-hint" style={{ textAlign: "center" }}>DATES USE YOUR STORE TIME ZONE ({tzAbbrev(store.settings!.timezone)}). EVERY REPORT HAS A [ PRINT ] BUTTON.</p>
    </Screen>
  );
}

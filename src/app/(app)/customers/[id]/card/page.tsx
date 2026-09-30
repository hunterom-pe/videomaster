import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { Screen } from "@/components/Screen";
import { code128Svg } from "@/lib/barcode";
import { db } from "@/lib/db";
import { fmtDateUS } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";

export const metadata = { title: "MEMBERSHIP CARD" };

export default async function MembershipCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const svg = code128Svg(c.membershipNumber);
  const since = fmtDateUS(c.createdAt, tz);

  return (
    <Screen title="MEMBERSHIP CARD" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions no-print" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>MEMBERSHIP CARD</h1>
        <Link href={`/customers/${c.id}`} className="vm-btn">[ ACCOUNT ]</Link>
      </div>
      <hr className="vm-rule no-print" />
      <h1 className="vm-sr-only">MEMBERSHIP CARD FOR {c.firstName} {c.lastName}</h1>
      <article className="vm-card" aria-label={`Membership card for ${c.firstName} ${c.lastName}`}>
        <div className="vm-card-store">{store.name.toUpperCase()} #{store.number}</div>
        <div className="vm-card-sub">{store.city.toUpperCase()}, {store.region.toUpperCase()} · {store.phone}</div>
        <div className="vm-card-name">{c.firstName.toUpperCase()} {c.lastName.toUpperCase()}</div>
        <div className="vm-card-meta">
          <span>MEMBER # {c.membershipNumber}</span>
          <span>{c.membershipExpiresAt ? `VALID THRU ${fmtDateUS(c.membershipExpiresAt, tz)}` : `SINCE ${since}`}</span>
        </div>
        <div className="vm-card-barcode" role="img" aria-label={`Barcode for member number ${c.membershipNumber}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="vm-card-num">{c.membershipNumber}</div>
      </article>
      <p className="vm-hint no-print">PRINT ON CARD STOCK OR PLAIN PAPER (CREDIT-CARD SIZE). SCANNING THE BARCODE INTO ANY CUSTOMER SEARCH BOX OPENS THIS MEMBER.</p>
      <div className="vm-actions no-print"><PrintButton /><Link href={`/customers/${c.id}`} className="vm-btn">[ CLOSE ]</Link></div>
    </Screen>
  );
}

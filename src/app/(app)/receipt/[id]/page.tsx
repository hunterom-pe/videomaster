import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/db";
import { FORMAT_LABELS } from "@/lib/inventory";
import { fmtDateUS } from "@/lib/pricing";
import { requireStore } from "@/lib/store-access";
import { PAYMENT_LABELS } from "@/lib/transactions";

export const metadata = { title: "RECEIPT" };

const rentalInclude = { copy: { include: { movieTitle: true } } } as const;
const money = (n: { toFixed(d: number): string } | number) => (Number(n) < 0 ? `-$${Math.abs(Number(n)).toFixed(2)}` : `$${Number(n).toFixed(2)}`);
const NO_TAX_TYPES = ["RETURN", "MEMBERSHIP_FEE", "ACCOUNT_PAYMENT", "FEE_WAIVER"];
const Row = ({ left, right, strong }: { left: string; right?: string; strong?: boolean }) => (
  <div className={`row${strong ? " strong" : ""}`}><span>{left}</span><span>{right}</span></div>
);

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { user, store } = await requireStore();
  const tz = store.settings!.timezone;
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const t = await db.transaction.findFirst({
    where: { id, storeId: store.id },
    include: {
      customer: true,
      items: { orderBy: { description: "asc" } },
      rentals: { orderBy: { rentedAt: "asc" }, include: rentalInclude },
      returnedRentals: { orderBy: { returnedAt: "asc" }, include: rentalInclude },
      refundOf: { select: { number: true } },
    },
  });
  if (!t) notFound();
  const name = (n: string) => n.toUpperCase();

  return (
    <Screen title="RECEIPT" userEmail={user.email} storeLine={`STORE: ${store.name} #${store.number}`} status={isNew ? "TRANSACTION COMPLETE" : "RECEIPT REPRINT"}>
      <h1 className="vm-sr-only">RECEIPT FOR TRANSACTION {String(t.number).padStart(6, "0")}</h1>
      {isNew && <div className="vm-notice no-print" role="status">*** TRANSACTION COMPLETE ***</div>}

      <article className="vm-receipt" aria-label={`Receipt for transaction ${t.number}`}>
        <div className="center strong">{name(store.name)} #{store.number}</div>
        <div className="center">{name(store.address)}</div>
        <div className="center">{name(store.city)}, {name(store.region)} {name(store.postalCode)}</div>
        <div className="center">{store.phone}</div>
        {store.slogan && <div className="center">&quot;{name(store.slogan)}&quot;</div>}
        <hr className="rule" />
        <Row left={fmtDateUS(t.createdAt, tz)} right={t.type === "ACCOUNT_PAYMENT" ? "ACCOUNT PMT" : t.type === "FEE_WAIVER" ? "WAIVER" : t.type === "REFUND" ? "REFUND" : t.type === "RETURN" ? "RETURN" : t.type === "RETAIL_SALE" ? "SALE" : t.type === "MEMBERSHIP_FEE" ? "MEMBERSHIP" : "RENTAL"} />
        <Row left={`TRANSACTION #${String(t.number).padStart(6, "0")}`} />
        {t.refundOf && <div>REFUND OF TRANSACTION #{String(t.refundOf.number).padStart(6, "0")}</div>}
        {t.voidedAt && <div className="center strong" style={{ marginTop: 6 }}>*** VOID ***</div>}
        {t.customer ? <div>CUSTOMER: {name(t.customer.firstName)} {name(t.customer.lastName)}</div> : null}
        {!isNew && <div className="center strong" style={{ marginTop: 6 }}>** REPRINT **</div>}
        <hr className="rule" />

        {(t.type === "ACCOUNT_PAYMENT" || t.type === "FEE_WAIVER") && (
          <div className="item"><Row left={t.type === "FEE_WAIVER" ? "BALANCE WAIVED" : "PAYMENT ON ACCOUNT"} right={money(Math.abs(Number(t.balanceChange)))} /></div>
        )}
        {t.type === "MEMBERSHIP_FEE" && (
          <div className="item">
            <Row left={t.notes ?? "MEMBERSHIP FEE"} right={money(t.total)} />
            {t.customer?.membershipExpiresAt && <div className="sub">VALID THROUGH {fmtDateUS(t.customer.membershipExpiresAt, tz)}</div>}
          </div>
        )}
        {t.rentals.map((r) => (
          <div key={r.id} className="item">
            <div>{name(r.copy.movieTitle.title)} {FORMAT_LABELS[r.copy.format]}</div>
            <Row left="RENTAL" right={money(r.price)} />
          </div>
        ))}
        {t.items.map((i) => (
          <div key={i.id} className="item">
            <Row left={`${name(i.description)}${Math.abs(i.quantity) > 1 ? ` X${Math.abs(i.quantity)}` : ""}`} right={money(i.lineTotal)} />
          </div>
        ))}
        {t.returnedRentals.map((r) => (
          <div key={r.id} className="item">
            <div>{name(r.copy.movieTitle.title)} {FORMAT_LABELS[r.copy.format]}</div>
            <div className="sub">
              {r.outcome === "LOST" ? "MARKED LOST" : r.outcome === "DAMAGED" ? "MARKED DAMAGED" : "RETURNED"}
            </div>
            {r.calculatedLateFee && Number(r.calculatedLateFee) > 0 && (
              <Row left={`LATE FEE${Number(r.chargedLateFee ?? 0) < Number(r.calculatedLateFee) ? (Number(r.chargedLateFee ?? 0) === 0 ? " (WAIVED)" : " (REDUCED)") : ""}`} right={money(r.chargedLateFee ?? 0)} />
            )}
            {r.otherFee && <Row left={r.outcome === "LOST" ? "LOST ITEM FEE" : "DAMAGE FEE"} right={money(r.otherFee)} />}
            {r.rewindFee && <Row left="REWIND FEE" right={money(r.rewindFee)} />}
          </div>
        ))}
        <hr className="rule" />

        {!NO_TAX_TYPES.includes(t.type) && <Row left="SUBTOTAL" right={money(t.subtotal)} />}
        {!NO_TAX_TYPES.includes(t.type) && <Row left="TAX" right={money(t.tax)} />}
        {t.type === "RETURN" && Number(t.balanceChange) > 0 && (
          <>
            <Row left="FEES CHARGED" right={money(Number(t.total) + Number(t.balanceChange))} />
            <Row left="PUT ON ACCOUNT" right={money(-Number(t.balanceChange))} />
          </>
        )}
        <Row left="TOTAL" right={money(t.total)} strong />
        {Number(t.total) > 0 && <Row left={PAYMENT_LABELS[t.paymentMethod]} right={money(t.total)} />}
        {t.customer && Number(t.balanceChange) !== 0 && Number(t.customer.outstandingFees) > 0 && <Row left="ACCOUNT BALANCE DUE" right={money(t.customer.outstandingFees)} strong />}
        {t.tendered && (
          <>
            <Row left="CASH TENDERED" right={money(t.tendered)} />
            <Row left="CHANGE" right={money(Number(t.tendered) - Number(t.total))} strong />
          </>
        )}
        {Number(t.total) < 0 && <Row left={`REFUNDED TO ${PAYMENT_LABELS[t.paymentMethod]}`} right={money(t.total)} />}
        {t.type === "REFUND" && t.notes && <div className="sub">{t.notes.replace(/^REFUND OF #\d+: /, "REASON: ").toUpperCase()}</div>}
        <hr className="rule" />

        {t.rentals.length > 0 && (
          <>
            {t.rentals.map((r) => (
              <div key={r.id} className="item">
                <div>{name(r.copy.movieTitle.title)} DUE:</div>
                <div className="sub">{fmtDateUS(r.dueAt, tz)}</div>
              </div>
            ))}
            <div className="center strong">PLEASE REWIND</div>
          </>
        )}
        <div className="center strong" style={{ marginTop: 6 }}>{name(store.settings!.receiptFooter || "THANK YOU!")}</div>
      </article>

      <div className="vm-actions no-print" style={{ justifyContent: "center" }}>
        <PrintButton />
        {isNew ? (
          <>
            <Link href="/rent" className="vm-btn">[ NEW RENTAL ]</Link>
            <Link href="/sale" className="vm-btn">[ NEW SALE ]</Link>
            <Link href="/menu" className="vm-btn">[ CLOSE ]</Link>
          </>
        ) : (
          <Link href={`/transactions/${t.id}`} className="vm-btn">[ CLOSE ]</Link>
        )}
      </div>
    </Screen>
  );
}

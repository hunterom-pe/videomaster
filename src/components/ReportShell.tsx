import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Screen } from "@/components/Screen";
import { tzAbbrev } from "@/lib/tz";

type Props = {
  title: string;
  user: string;
  store: { name: string; number: string };
  slug: string;
  tz: string;
  filter?: { kind: "range"; from: string; to: string } | { kind: "day"; day: string };
  notice?: string;
  csv?: boolean; // offer a CSV download of this report
  children: React.ReactNode;
};

export function ReportShell({ title, user, store, slug, tz, filter, notice, csv, children }: Props) {
  const csvHref = `/reports/${slug}/csv${filter?.kind === "range" ? `?from=${encodeURIComponent(filter.from)}&to=${encodeURIComponent(filter.to)}` : ""}`;
  const period = filter?.kind === "range" ? `${filter.from} TO ${filter.to}` : filter?.kind === "day" ? filter.day : "AS OF NOW";
  return (
    <Screen title={`REPORT: ${title}`} userEmail={user} storeLine={`STORE: ${store.name} #${store.number}`}>
      <div className="vm-actions no-print" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h1>{title}</h1>
        <span className="vm-actions" style={{ marginTop: 0 }}>
          <PrintButton />
          {csv && <a href={csvHref} className="vm-btn" download>[ DOWNLOAD CSV ]</a>}
          <Link href="/reports" className="vm-btn">[ ALL REPORTS ]</Link>
        </span>
      </div>
      <hr className="vm-rule no-print" />
      {notice && <div className="vm-notice no-print" role="status">{notice}</div>}
      {filter && (
        <form action={`/reports/${slug}`} method="get" className="vm-searchbar no-print">
          {filter.kind === "range" ? (
            <>
              <div className="vm-field" style={{ flex: "0 1 190px" }}>
                <label htmlFor="from">FROM (YYYY-MM-DD)</label>
                <input id="from" name="from" type="text" defaultValue={filter.from} autoComplete="off" />
              </div>
              <div className="vm-field" style={{ flex: "0 1 190px" }}>
                <label htmlFor="to">TO (YYYY-MM-DD)</label>
                <input id="to" name="to" type="text" defaultValue={filter.to} autoComplete="off" />
              </div>
            </>
          ) : (
            <div className="vm-field" style={{ flex: "0 1 190px" }}>
              <label htmlFor="date">DATE (YYYY-MM-DD)</label>
              <input id="date" name="date" type="text" defaultValue={filter.day} autoComplete="off" />
            </div>
          )}
          <button type="submit" className="vm-btn">[ RUN REPORT ]</button>
        </form>
      )}
      <div className="vm-report">
        <div className="vm-report-head">
          <strong>{store.name.toUpperCase()} #{store.number} — {title}</strong>
          <div>PERIOD: {period} ({tzAbbrev(tz)}) · PRINTED FROM VIDEOMASTER V1.0</div>
        </div>
        {children}
      </div>
    </Screen>
  );
}

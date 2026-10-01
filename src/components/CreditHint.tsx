import { fmtMoney } from "@/lib/pricing";

/** Shown under a payment-method select: how much store credit the customer has, and whether it covers the amount due. */
export function CreditHint({ method, creditCents, dueCents }: { method: string; creditCents: number; dueCents: number }) {
  if (method !== "STORE_CREDIT") return creditCents > 0 ? <span className="vm-hint">STORE CREDIT AVAILABLE: {fmtMoney(creditCents)}</span> : null;
  const short = dueCents > creditCents;
  return (
    <span className={short ? "vm-red" : "vm-yellow"} aria-live="polite">
      {short ? `NOT ENOUGH STORE CREDIT: ${fmtMoney(creditCents)} AVAILABLE, ${fmtMoney(dueCents)} DUE` : `STORE CREDIT AVAILABLE: ${fmtMoney(creditCents)} (${fmtMoney(creditCents - dueCents)} LEFT AFTER THIS)`}
    </span>
  );
}

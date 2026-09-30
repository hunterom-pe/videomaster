// Refund arithmetic (pure; shared by the refund screen's live preview and the server). All amounts are cents.

export type RefundTaxInput = {
  /** Taxable part of what is being refunded now. */
  refundTaxableCents: number;
  /** Tax charged on the original transaction. */
  originalTaxCents: number;
  /** Taxable part of the whole original transaction (what the tax was charged on). */
  originalTaxableBaseCents: number;
  /** Tax not yet refunded by earlier refunds (original tax minus tax already given back). */
  remainingTaxCents: number;
  /** True when this refund covers everything still refundable: then the exact remaining tax is returned. */
  isFinalRefund: boolean;
};

/**
 * Tax to give back: the refunded taxable amount's proportional share of the original tax, never more than what
 * remains. The final refund returns exactly what remains, so rounding can never leave pennies behind or over-refund.
 */
export function refundTaxCents(i: RefundTaxInput): number {
  if (i.originalTaxCents <= 0 || i.originalTaxableBaseCents <= 0 || i.remainingTaxCents <= 0) return 0;
  if (i.isFinalRefund) return i.remainingTaxCents;
  const share = Math.round((i.refundTaxableCents * i.originalTaxCents) / i.originalTaxableBaseCents);
  return Math.min(share, i.remainingTaxCents);
}

export type RefundLine = { cents: number; taxable: boolean };

export function refundTotals(lines: RefundLine[], tax: Omit<RefundTaxInput, "refundTaxableCents">) {
  const subtotal = lines.reduce((n, l) => n + l.cents, 0);
  const refundTaxableCents = lines.filter((l) => l.taxable).reduce((n, l) => n + l.cents, 0);
  const taxCents = refundTaxCents({ ...tax, refundTaxableCents });
  return { subtotal, tax: taxCents, total: subtotal + taxCents };
}

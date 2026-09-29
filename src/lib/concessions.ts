// Stock status helpers (pure; safe on client and server).
export type StockState = "OUT" | "LOW" | "OK";

export function stockState(quantityOnHand: number, threshold: number): StockState {
  if (quantityOnHand <= 0) return "OUT";
  return quantityOnHand <= threshold ? "LOW" : "OK";
}

// Types for the Exchange Rate tool.
//
// Every column in the table is a real feed with a named upstream. There is no
// derived or estimated value anywhere: if a source has no rate for a currency,
// the cell renders an em dash instead of inventing a number.

export type RateSortKey = "code" | "unionpay" | "mastercard" | "visa" | "google" | "sina" | "xe";

export type RateEntry = {
  /** currency-api daily snapshot value (1 USD = X of this currency). */
  reference?: number | null;
  /** ExchangeRate-API backup feed. */
  backup?: number | null;
  // Per-source real rates, when available for a currency.
  sina?: number | null;
  xe?: number | null;
  google?: number | null;
  unionpay?: number | null;
  mastercard?: number | null;
  visa?: number | null;
};

/** Guard so callers never render NaN or negatives. */
export function isUsableRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

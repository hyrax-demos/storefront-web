// Conversions between dollar amounts and integer cents.
//
// Cart and promo math runs entirely in integer cents. Dollars only appear at
// the edges: prices quoted by the external catalog API, and the final
// on-screen display string.

// Convert a dollar amount (as quoted by the catalog API) to integer cents.
// Catalog prices have at most 2 decimal places, so rounding the scaled value
// is exact for them (e.g. 0.1 -> 10, 1.10 -> 110, 19.99 -> 1999).
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Format integer cents as a dollar string with exactly 2 decimals, e.g.
// 1999 -> "19.99", 5 -> "0.05", -250 -> "-2.50". Uses integer arithmetic only
// (no float division). The currency symbol is left to the caller.
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

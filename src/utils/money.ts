/**
 * Convert a dollar amount (e.g. a catalog API price) to integer cents.
 *
 * Rounds to the nearest cent so float representation error in the dollar
 * value (19.99 * 100 === 1998.9999999999998) never leaks into cent math.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format integer cents as a dollar amount string without the currency symbol,
 * always with two decimals (e.g. 1999 -> "19.99", 500 -> "5.00").
 *
 * Uses integer division plus a zero-padded remainder so no float formatting
 * is involved. Callers add the "$" when rendering.
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${String(remainder).padStart(2, "0")}`;
}

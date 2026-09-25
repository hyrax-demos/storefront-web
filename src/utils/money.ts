/**
 * Convert a dollar amount (e.g. a catalog API price) to integer cents.
 *
 * Rounds to the nearest cent so float representation error in the dollar
 * value (19.99 * 100 === 1998.9999999999998) never leaks into cent math.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

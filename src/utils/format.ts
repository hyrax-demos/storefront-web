// Render an integer number of cents as US dollars, e.g. 1234 -> "$12.34".
// Negative amounts put the sign before the "$", e.g. -250 -> "-$2.50".
// Uses integer arithmetic only, so there is no floating-point rounding.
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`formatCents expects an integer, got ${cents}`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${remainder}`;
}

// Render a ratio as a whole-number percent, e.g. 0.25 -> "25%", 0.125 -> "13%".
// Rounds with Math.round.
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

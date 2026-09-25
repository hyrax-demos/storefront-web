// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 10000, percentOff: 10 } (10% off at $100.00+).
export interface PromoRule {
  // Minimum cart subtotal, in integer cents, required for the discount to
  // apply. A subtotal strictly below this gets no discount; a subtotal at or
  // above it gets the discount.
  minSubtotal: number;
  percentOff: number;
}

// Compute the discount, in integer cents, for a rule given a subtotal in
// integer cents. Returns 0 when the cart hasn't cleared the threshold.
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.minSubtotal) return 0;
  // Round HALF UP to the nearest cent using integer arithmetic only, so float
  // error can never move a value across the .5 boundary (and no banker's
  // rounding). `percentOff` is an integer in practice, but the backend type
  // doesn't forbid a fractional value like 12.5, so we first scale it to
  // integer basis points (1% = 100 bp; exact for up to 2 decimal places).
  // For an integer percent p this is exactly
  //   Math.floor((subtotal * p + 50) / 100).
  const basisPoints = Math.round(rule.percentOff * 100);
  return Math.floor((subtotal * basisPoints + 5000) / 10000);
}

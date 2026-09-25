// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 10000, percentOff: 10 } is "10% off orders
// of $100.00 or more".
export interface PromoRule {
  // Threshold in integer cents. A subtotal strictly below this gets no
  // discount; a subtotal at or above it gets the discount.
  minSubtotal: number;
  // Percentage off, e.g. 10 for 10%. May be fractional (e.g. 12.5); it is
  // resolved to integer basis points (hundredths of a percent).
  percentOff: number;
}

// Compute the discount in integer cents for a rule, given a subtotal in
// integer cents. Returns 0 when the cart hasn't cleared the threshold.
//
// Rounding is HALF UP to the nearest cent (an exact half cent rounds up).
// To stay exact we never multiply by a float fraction: percentOff is scaled
// to integer basis points (bp = percentOff * 100), so the exact discount is
// subtotal * bp / 10000 cents, and half-up rounding of that is
//   Math.floor((subtotal * bp + 5000) / 10000)
// which is all-integer arithmetic (for an integer percent p this is
// equivalent to Math.floor((subtotal * p + 50) / 100)).
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.minSubtotal) return 0;
  const basisPoints = Math.round(rule.percentOff * 100);
  return Math.floor((subtotal * basisPoints + 5000) / 10000);
}

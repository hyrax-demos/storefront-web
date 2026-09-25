// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 10000, percentOff: 10 } (10% off at $100).
export interface PromoRule {
  /**
   * Threshold in integer cents (e.g. 5000 for $50.00). A subtotal strictly
   * below this gets no discount; a subtotal at or above it gets the discount.
   */
  minSubtotal: number;
  /**
   * Percentage off, e.g. 10 for 10%. Fractional percents are supported to a
   * resolution of 0.01% (one basis point); finer precision is rounded to the
   * nearest basis point.
   */
  percentOff: number;
}

const BASIS_POINTS_PER_WHOLE = 10_000;

/**
 * Compute the discount for a rule.
 *
 * @param rule - The promo rule; `minSubtotal` is in integer cents.
 * @param subtotal - Cart subtotal in integer cents.
 * @returns The discount in integer cents, rounded HALF UP to the nearest cent
 *   (an exact half-cent always rounds up: 0.5 -> 1, 1.5 -> 2, 2.5 -> 3).
 *   Returns 0 when `subtotal < rule.minSubtotal`.
 */
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.minSubtotal) return 0;
  // Scale the percent to integer basis points so the whole computation stays
  // in integers and an exact half-cent can never drift to x.4999...
  const basisPoints = Math.round(rule.percentOff * 100);
  return Math.floor(
    (subtotal * basisPoints + BASIS_POINTS_PER_WHOLE / 2) /
      BASIS_POINTS_PER_WHOLE,
  );
}

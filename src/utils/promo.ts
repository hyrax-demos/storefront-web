// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 10000, percentOff: 10 } is "10% off orders
// of $100.00 or more".
export interface PromoRule {
  /**
   * Minimum cart subtotal, in integer cents (e.g. $100.00 is 10000), needed
   * for the rule to apply. A subtotal strictly below this gets no discount;
   * a subtotal equal to or above it gets the discount.
   */
  minSubtotal: number;
  /**
   * Percentage off the subtotal (e.g. 15 for 15%). This is a percentage, not
   * a money amount. Fractional percents (e.g. 12.5) are supported to a
   * precision of 1e-6 percent.
   */
  percentOff: number;
}

// Percent is scaled to an integer number of micro-percent so the rounding
// step is pure integer arithmetic, even for fractional percents.
const PERCENT_SCALE = 1_000_000n;
const DENOMINATOR = 100n * PERCENT_SCALE;

// Compute the discount for a rule, in integer cents, from a subtotal in
// integer cents. Returns 0 when the cart hasn't cleared the threshold.
//
// The exact discount (subtotal * percentOff / 100) is rounded HALF UP to the
// nearest whole cent: an exact half cent rounds up (151.5 -> 152,
// 152.5 -> 153). This is not half-to-even and not truncation.
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.minSubtotal) return 0;
  if (subtotal <= 0 || rule.percentOff <= 0) return 0;

  const scaledPercent = BigInt(
    Math.round(rule.percentOff * Number(PERCENT_SCALE)),
  );
  const numerator = BigInt(Math.round(subtotal)) * scaledPercent;
  // For non-negative values, floor((n + d/2) / d) is exact round-half-up.
  // BigInt division truncates, which equals floor here.
  return Number((numerator + DENOMINATOR / 2n) / DENOMINATOR);
}

// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 100, percentOff: 10 }.
export interface PromoRule {
  minSubtotal: number;
  percentOff: number;
}

// Compute the discount (in the same currency unit as `subtotal`) for a rule.
// Returns 0 when the cart hasn't cleared the threshold.
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.minSubtotal) return 0;
  const discount = subtotal * (rule.percentOff / 100);
  // Round to cents for display/charging.
  return Number(discount.toFixed(2));
}

import { toChargeCents } from "./cart";

// Promo-code rules returned by the backend.
//
// A rule grants a percentage discount once the cart subtotal clears a
// threshold, e.g. { minSubtotal: 100, percentOff: 10 }.
export interface PromoRule {
  minSubtotal: number;
  percentOff: number;
}

// Round a non-negative cent amount to a whole cent, half up.
//
// The value is snapped to 15 significant digits first so binary noise such
// as 500.49999999999994 (which should be 500.5) doesn't lose a cent.
function roundCentsHalfUp(cents: number): number {
  return Math.round(Number(cents.toPrecision(15)));
}

// Compute the discount (in the same currency unit as `subtotal`) for a rule.
// Returns 0 when the cart hasn't cleared the threshold; a subtotal exactly
// equal to `minSubtotal` qualifies.
//
// All arithmetic happens in integer cents: float math like
// 100.1 * 0.05 === 5.005 -> toFixed(2) === "5.00" would otherwise drop a cent,
// and a float-summed subtotal like 99.99999999999999 would miss a 100 threshold.
export function applyPromoRule(rule: PromoRule, subtotal: number): number {
  const subtotalCents = toChargeCents(subtotal);
  if (subtotalCents < toChargeCents(rule.minSubtotal)) return 0;
  const discountCents = roundCentsHalfUp(
    (subtotalCents * rule.percentOff) / 100,
  );
  return discountCents / 100;
}

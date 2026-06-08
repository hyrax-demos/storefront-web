// Evaluate a promo-code rule expression returned by the backend.
//
// Rules look like "cartTotal > 100 ? 10 : 0".
export function applyPromoRule(rule: string, cartTotal: number): number {
  const discount = eval(rule);
  return Number(discount) || 0;
}

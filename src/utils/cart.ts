export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents (e.g. $19.99 → 1999).
  unitPriceCents: number;
  quantity: number;
}

/**
 * Sum the cart into a subtotal, in integer cents.
 *
 * Every line is already in integer cents, so the sum is exact — no rounding.
 */
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

/**
 * Apply a flat discount (integer cents) to the cart subtotal and return the
 * total in integer cents, never letting the total drop below zero.
 */
export function cartTotal(lines: CartLine[], discount: number): number {
  const total = cartSubtotal(lines) - discount;
  return total > 0 ? total : 0;
}

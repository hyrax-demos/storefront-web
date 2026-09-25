export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents (e.g. $19.99 is 1999).
  unitPriceCents: number;
  quantity: number;
}

/**
 * Sum the cart into a subtotal.
 *
 * @returns the exact subtotal in integer cents.
 */
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sumCents, line) => sumCents + line.unitPriceCents * line.quantity,
    0,
  );
}

/**
 * Apply a flat discount, never letting the total drop below zero.
 *
 * @param discount the discount in integer cents.
 * @returns the total in integer cents.
 */
export function cartTotal(lines: CartLine[], discount: number): number {
  const totalCents = cartSubtotal(lines) - discount;
  return totalCents > 0 ? totalCents : 0;
}

export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents.
  unitPriceCents: number;
  quantity: number;
}

// Sum the cart into a subtotal in integer cents. Exact: every term is an
// integer, so no rounding is needed or applied.
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sumCents, line) => sumCents + line.unitPriceCents * line.quantity,
    0,
  );
}

// Apply a flat discount (integer cents) to the subtotal and return the total
// in integer cents, never letting it drop below zero.
export function cartTotal(lines: CartLine[], discount: number): number {
  const totalCents = cartSubtotal(lines) - discount;
  return totalCents > 0 ? totalCents : 0;
}

export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents (e.g. $19.99 is 1999).
  unitPriceCents: number;
  quantity: number;
}

// Sum the cart into a subtotal, in integer cents.
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

// Apply a flat discount (integer cents) and return the total in integer
// cents, never letting the total drop below zero.
export function cartTotal(lines: CartLine[], discount: number): number {
  const totalCents = cartSubtotal(lines) - discount;
  return totalCents > 0 ? totalCents : 0;
}

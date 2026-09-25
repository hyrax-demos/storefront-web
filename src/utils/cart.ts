export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents.
  unitPriceCents: number;
  quantity: number;
}

// Sum the cart into a subtotal in integer cents. Exact integer arithmetic,
// no rounding.
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

// Apply a flat discount in integer cents, never letting the total drop below
// zero. Returns integer cents.
export function cartTotal(lines: CartLine[], discount: number): number {
  const total = cartSubtotal(lines) - discount;
  return total > 0 ? total : 0;
}

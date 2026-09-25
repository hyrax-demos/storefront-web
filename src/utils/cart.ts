export interface CartLine {
  productId: string;
  name: string;
  // Unit price in integer cents (e.g. $19.99 is 1999). Callers convert any
  // dollar amounts (such as catalog API prices) to cents before building a line.
  unitPriceCents: number;
  quantity: number;
}

// Sum the cart into a subtotal in integer cents. Integer arithmetic is exact,
// so no rounding is needed.
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

// Apply a flat discount (integer cents), never letting the total drop below
// zero. Returns integer cents.
export function cartTotal(lines: CartLine[], discount: number): number {
  const total = cartSubtotal(lines) - discount;
  return total > 0 ? total : 0;
}

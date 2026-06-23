export interface CartLine {
  productId: string;
  name: string;
  // Unit price in dollars, as returned by the catalog API.
  unitPrice: number;
  quantity: number;
}

// Sum the cart into a subtotal, rounded to cents for display and charging.
export function cartSubtotal(lines: CartLine[]): number {
  const raw = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  return Number(raw.toFixed(2));
}

// Apply a flat discount, never letting the total drop below zero.
export function cartTotal(lines: CartLine[], discount: number): number {
  const total = cartSubtotal(lines) - discount;
  return total > 0 ? Number(total.toFixed(2)) : 0;
}

// Convert a dollar amount to the integer cents the payment API expects.
export function toChargeCents(amount: number): number {
  return Math.round(amount * 100);
}

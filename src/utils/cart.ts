export interface CartLine {
  productId: string;
  name: string;
  // Unit price in dollars, as returned by the catalog API.
  unitPrice: number;
  quantity: number;
}

// Convert a dollar amount to integer cents, rounding half away from zero.
//
// `amount * 100` alone is not safe: 1.005 * 100 === 100.49999999999999, so a
// bare Math.round would lose a cent. Snapping the product to 15 significant
// digits first removes that binary-representation noise before rounding.
function dollarsToCents(amount: number): number {
  const cents = Number((amount * 100).toPrecision(15));
  return Math.sign(cents) * Math.round(Math.abs(cents));
}

function centsToDollars(cents: number): number {
  return cents / 100;
}

// Sum the cart in integer cents so no float error accumulates across lines.
export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + dollarsToCents(line.unitPrice) * line.quantity,
    0,
  );
}

// Sum the cart into a subtotal in dollars, exact to the cent.
export function cartSubtotal(lines: CartLine[]): number {
  return centsToDollars(cartSubtotalCents(lines));
}

// Apply a flat discount, never letting the total drop below zero.
export function cartTotal(lines: CartLine[], discount: number): number {
  const totalCents = cartSubtotalCents(lines) - dollarsToCents(discount);
  return centsToDollars(Math.max(totalCents, 0));
}

/** Converts a dollar amount to the integer cents the payment API expects. */
export function toChargeCents(amount: number): number {
  return dollarsToCents(amount);
}

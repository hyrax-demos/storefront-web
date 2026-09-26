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

// A discount is either a flat dollar amount or a percentage of the subtotal.
export type CartDiscount = number | { percentOff: number };

// Resolve a discount to integer cents against a subtotal already in cents.
//
// A percentage is applied to the cent subtotal and rounded half away from
// zero, with the same 15-significant-digit snap as dollarsToCents so float
// noise (e.g. 500.49999999999994 for 500.5) doesn't lose a cent.
function discountCents(subtotalCents: number, discount: CartDiscount): number {
  if (typeof discount === "number") return dollarsToCents(discount);
  const cents = Number(
    ((subtotalCents * discount.percentOff) / 100).toPrecision(15),
  );
  return Math.sign(cents) * Math.round(Math.abs(cents));
}

// Apply a flat or percentage discount, never letting the total drop below
// zero.
export function cartTotal(lines: CartLine[], discount: CartDiscount): number {
  const subtotalCents = cartSubtotalCents(lines);
  const totalCents = subtotalCents - discountCents(subtotalCents, discount);
  return centsToDollars(Math.max(totalCents, 0));
}

/** Converts a dollar amount to the integer cents the payment API expects. */
export function toChargeCents(amount: number): number {
  return dollarsToCents(amount);
}

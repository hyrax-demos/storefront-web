import { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { cartSubtotal, cartTotal, type CartLine } from "../utils/cart";
import { applyPromoRule, type PromoRule } from "../utils/promo";

// No shared money formatter exists in src/utils yet; keep a local one.
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export interface CartSummaryProps {
  // Defaults to the lines held by the surrounding <CartProvider>.
  lines?: CartLine[];
  // Promo rule to apply; no discount when absent or when the cart does not
  // clear the rule's threshold.
  promo?: PromoRule | null;
}

export function CartSummary({
  lines: linesProp,
  promo = null,
}: CartSummaryProps) {
  // Read the context directly (rather than useCart()) so explicit `lines`
  // work without a provider; still fail loudly when neither is available.
  const ctx = useContext(CartContext);
  const lines = linesProp ?? ctx?.lines;
  if (!lines) {
    throw new Error(
      "<CartSummary> needs a `lines` prop or a surrounding <CartProvider>.",
    );
  }

  if (lines.length === 0) {
    return (
      <div
        className="cart-summary cart-summary--empty"
        data-testid="cart-empty"
      >
        Your cart is empty.
      </div>
    );
  }

  const subtotal = cartSubtotal(lines);
  const discount = promo ? applyPromoRule(promo, subtotal) : 0;
  const total = cartTotal(lines, discount);

  return (
    <dl className="cart-summary" aria-label="Cart summary">
      <dt>Subtotal</dt>
      <dd data-testid="cart-subtotal">{usd.format(subtotal)}</dd>
      <dt>Discount</dt>
      <dd data-testid="cart-discount">
        {discount > 0 ? `-${usd.format(discount)}` : usd.format(0)}
      </dd>
      <dt>Total</dt>
      <dd data-testid="cart-total">{usd.format(total)}</dd>
    </dl>
  );
}

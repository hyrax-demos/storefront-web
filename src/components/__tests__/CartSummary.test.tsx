import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CartSummary } from "../CartSummary";
import { CartProvider } from "../../context/CartContext";
import { CART_STORAGE_KEY } from "../../context/cartStorage";
import type { CartLine } from "../../utils/cart";
import type { PromoRule } from "../../utils/promo";

// Subtotal: 12.5 * 2 + 80 * 1 = 105.
const lines: CartLine[] = [
  { productId: "p-1", name: "Mug", unitPrice: 12.5, quantity: 2 },
  { productId: "p-2", name: "Book", unitPrice: 80, quantity: 1 },
];
const tenOffOver100: PromoRule = { minSubtotal: 100, percentOff: 10 };

const text = (id: string) => screen.getByTestId(id).textContent;

describe("CartSummary", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows subtotal, promo discount and total for a qualifying promo", () => {
    render(<CartSummary lines={lines} promo={tenOffOver100} />);
    expect(text("cart-subtotal")).toBe("$105.00");
    // 10% of 105 = 10.50; 105 - 10.50 = 94.50.
    expect(text("cart-discount")).toBe("-$10.50");
    expect(text("cart-total")).toBe("$94.50");
  });

  it("applies no discount without a promo", () => {
    render(<CartSummary lines={lines} />);
    expect(text("cart-discount")).toBe("$0.00");
    expect(text("cart-total")).toBe("$105.00");
  });

  it("applies no discount when the promo threshold is not met", () => {
    render(
      <CartSummary
        lines={lines}
        promo={{ minSubtotal: 200, percentOff: 10 }}
      />,
    );
    expect(text("cart-discount")).toBe("$0.00");
    expect(text("cart-total")).toBe("$105.00");
  });

  it("renders an empty state when there are no lines", () => {
    render(<CartSummary lines={[]} promo={tenOffOver100} />);
    expect(text("cart-empty")).toMatch(/empty/i);
    expect(screen.queryByTestId("cart-total")).toBeNull();
  });

  it("reads lines from CartProvider when no lines prop is given", () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    render(
      <CartProvider>
        <CartSummary promo={tenOffOver100} />
      </CartProvider>,
    );
    expect(text("cart-subtotal")).toBe("$105.00");
    expect(text("cart-total")).toBe("$94.50");
  });

  it("shows the empty state for an empty provider cart", () => {
    render(
      <CartProvider>
        <CartSummary />
      </CartProvider>,
    );
    expect(screen.getByTestId("cart-empty")).toBeTruthy();
  });
});

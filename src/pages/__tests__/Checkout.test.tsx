import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Checkout } from "../Checkout";
import { CartProvider } from "../../context/CartContext";
import { CART_STORAGE_KEY } from "../../context/cartStorage";
import type { CartLine } from "../../utils/cart";

// Subtotal: 12.5 * 2 + 80 * 1 = 105.
const lines: CartLine[] = [
  { productId: "p-1", name: "Mug", unitPrice: 12.5, quantity: 2 },
  { productId: "p-2", name: "Book", unitPrice: 80, quantity: 1 },
];

const text = (id: string) => screen.getByTestId(id).textContent;

describe("Checkout", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    // Catalog repricing returns no overrides, so stored prices are used.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 })),
    );
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the persisted cart with its summary total", async () => {
    render(
      <CartProvider>
        <Checkout promo={{ minSubtotal: 100, percentOff: 10 }} />
      </CartProvider>,
    );
    expect(text("cart-subtotal")).toBe("$105.00");
    expect(text("cart-total")).toBe("$94.50");
    // Let the catalog price fetch settle inside the test.
    await screen.findByText("Total: $94.50");
  });

  it("updates the summary when a quantity control is used", async () => {
    render(
      <CartProvider>
        <Checkout promo={null} />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Decrease Mug" }));
    expect(text("cart-total")).toBe("$92.50");
    fireEvent.click(screen.getByRole("button", { name: "Remove Book" }));
    expect(text("cart-total")).toBe("$12.50");
    await screen.findByText("Total: $12.50");
  });
});

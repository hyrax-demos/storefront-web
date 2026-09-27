import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartBadge } from "../CartBadge";
import { CartProvider } from "../../context/CartContext";
import { CART_STORAGE_KEY } from "../../context/cartStorage";
import type { CartLine } from "../../utils/cart";

// Count: 2 + 1 = 3. Subtotal: 12.5 * 2 + 80 = 105.
const lines: CartLine[] = [
  { productId: "p-1", name: "Mug", unitPrice: 12.5, quantity: 2 },
  { productId: "p-2", name: "Book", unitPrice: 80, quantity: 1 },
];

function renderBadge(stored: CartLine[] = lines) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stored));
  return render(
    <CartProvider>
      <p data-testid="outside">Elsewhere</p>
      <CartBadge />
    </CartProvider>,
  );
}

const count = () => screen.getByTestId("cart-badge-count").textContent;
const toggle = () => screen.getByRole("button", { name: /^Cart,/ });
const dropdown = () => screen.queryByTestId("mini-cart");

describe("CartBadge", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows the total item count and toggles the dropdown", () => {
    renderBadge();
    expect(count()).toBe("3");
    expect(dropdown()).toBeNull();
    fireEvent.click(toggle());
    expect(dropdown()).not.toBeNull();
    expect(screen.getByTestId("mini-cart-subtotal").textContent).toBe(
      "$105.00",
    );
    fireEvent.click(toggle());
    expect(dropdown()).toBeNull();
  });

  it("shows a zero count for an empty cart", () => {
    renderBadge([]);
    expect(count()).toBe("0");
  });

  it("removes a line and updates the count and subtotal", () => {
    renderBadge();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "Remove Mug" }));
    expect(count()).toBe("1");
    expect(screen.queryByRole("button", { name: "Remove Mug" })).toBeNull();
    expect(screen.getByTestId("mini-cart-subtotal").textContent).toBe(
      "$80.00",
    );
    // Removing from inside the dropdown must not close it.
    expect(dropdown()).not.toBeNull();
  });

  it("closes on a click outside", () => {
    renderBadge();
    fireEvent.click(toggle());
    fireEvent.mouseDown(screen.getByTestId("mini-cart"));
    expect(dropdown()).not.toBeNull();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(dropdown()).toBeNull();
  });

  it("closes on Escape", () => {
    renderBadge();
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: "Enter" });
    expect(dropdown()).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dropdown()).toBeNull();
  });
});

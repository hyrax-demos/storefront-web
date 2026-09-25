import { describe, it, expect } from "vitest";
import { cartSubtotal, cartTotal, type CartLine } from "../cart";

function line(
  productId: string,
  unitPriceCents: number,
  quantity: number,
): CartLine {
  return { productId, name: `Product ${productId}`, unitPriceCents, quantity };
}

describe("cartSubtotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("multiplies unit price by quantity and sums lines in cents", () => {
    const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];

    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("sums 10 + 20 + 30 cents to exactly 60 (0.1 + 0.2 + 0.3 in dollars)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];

    expect(cartSubtotal(lines)).toBe(60);
  });

  it("computes a 1999-cent line x 3 as exactly 5997", () => {
    expect(cartSubtotal([line("p-100", 1999, 3)])).toBe(5997);
  });

  it("returns an integer number of cents", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];

    expect(Number.isInteger(cartSubtotal(lines))).toBe(true);
    expect(Number.isInteger(cartSubtotal([line("p-100", 1999, 3)]))).toBe(true);
  });
});

describe("cartTotal", () => {
  it("returns 0 for an empty cart with no discount", () => {
    expect(cartTotal([], 0)).toBe(0);
  });

  it("returns the subtotal when the discount is 0", () => {
    expect(cartTotal([line("p-100", 1999, 3)], 0)).toBe(5997);
  });

  it("subtracts a cents discount exactly", () => {
    expect(cartTotal([line("p-100", 1999, 3)], 600)).toBe(5397);
  });

  it("subtracts a discount from a float-unfriendly subtotal exactly", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];

    expect(cartTotal(lines, 10)).toBe(50);
  });

  it("clamps at zero when the discount equals the subtotal", () => {
    expect(cartTotal([line("p-100", 1999, 1)], 1999)).toBe(0);
  });

  it("clamps at zero when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("p-100", 1999, 1)], 5000)).toBe(0);
  });

  it("clamps at zero for an empty cart with a discount", () => {
    expect(cartTotal([], 500)).toBe(0);
  });

  it("returns an integer number of cents suitable for charging", () => {
    const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];

    for (const discountCents of [0, 1, 99, 600, 5248, 10000]) {
      expect(Number.isInteger(cartTotal(lines, discountCents))).toBe(true);
    }
  });
});

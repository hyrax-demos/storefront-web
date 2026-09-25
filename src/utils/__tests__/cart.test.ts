import { describe, it, expect } from "vitest";
import { cartSubtotal, cartTotal, type CartLine } from "../cart";

function line(
  productId: string,
  unitPriceCents: number,
  quantity: number,
): CartLine {
  return { productId, name: productId, unitPriceCents, quantity };
}

describe("cartSubtotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("sums unitPriceCents * quantity across lines", () => {
    const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];
    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("sums exactly where float dollars would drift", () => {
    // In dollars: 0.1 + 0.1 + 0.1 + 0.2 === 0.5000000000000001
    const lines = [
      line("a", 10, 1),
      line("b", 10, 1),
      line("c", 10, 1),
      line("d", 20, 1),
    ];
    expect(cartSubtotal(lines)).toBe(50);
  });

  it("always returns an integer", () => {
    const lines = [line("a", 1999, 3), line("b", 1, 7), line("c", 33, 3)];
    const subtotal = cartSubtotal(lines);
    expect(Number.isInteger(subtotal)).toBe(true);
    expect(subtotal).toBe(6103);
  });
});

describe("cartTotal", () => {
  const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];

  it("returns the subtotal when the discount is 0", () => {
    expect(cartTotal(lines, 0)).toBe(5248);
  });

  it("subtracts a discount given in cents", () => {
    const total = cartTotal(lines, 525);
    expect(total).toBe(4723);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("clamps at 0 when the discount equals the subtotal", () => {
    expect(cartTotal(lines, 5248)).toBe(0);
  });

  it("clamps at 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal(lines, 10_000)).toBe(0);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([], 0)).toBe(0);
  });
});

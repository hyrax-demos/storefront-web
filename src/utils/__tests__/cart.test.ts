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

  it("multiplies unit price by quantity exactly", () => {
    expect(cartSubtotal([line("a", 1999, 3)])).toBe(5997);
  });

  it("sums amounts that float dollars get wrong (0.1 + 0.2 + 0.3)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];
    expect(cartSubtotal(lines)).toBe(60);
  });

  it("returns an integer number of cents", () => {
    const lines = [line("a", 1999, 3), line("b", 10, 7), line("c", 33, 1)];
    const subtotal = cartSubtotal(lines);
    expect(Number.isInteger(subtotal)).toBe(true);
    expect(subtotal).toBe(5997 + 70 + 33);
  });
});

describe("cartTotal", () => {
  it("returns 0 for an empty cart with no discount", () => {
    expect(cartTotal([], 0)).toBe(0);
  });

  it("subtracts a cents discount exactly", () => {
    expect(cartTotal([line("a", 1999, 3)], 600)).toBe(5397);
  });

  it("returns the subtotal unchanged when the discount is 0", () => {
    expect(cartTotal([line("a", 10, 1), line("b", 20, 1)], 0)).toBe(30);
  });

  it("clamps at zero when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("a", 500, 1)], 800)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal([line("a", 500, 1)], 500)).toBe(0);
  });

  // Previously guaranteed by toChargeCents: the amount charged is an integer
  // number of cents. cartTotal now returns that value directly.
  it("returns an integer number of cents suitable for charging", () => {
    const total = cartTotal(
      [line("a", 1999, 3), line("b", 10, 1), line("c", 20, 1)],
      601,
    );
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(5997 + 30 - 601);
  });
});

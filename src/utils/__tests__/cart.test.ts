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

  it("is exact where float dollars would drift (10 + 20 cents)", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in float dollars.
    const lines = [line("a", 10, 1), line("b", 20, 1)];
    expect(cartSubtotal(lines)).toBe(30);
  });

  it("is exact for 1999 x 3", () => {
    // 19.99 * 3 === 59.97000000000001 in float dollars.
    expect(cartSubtotal([line("a", 1999, 3)])).toBe(5997);
  });

  it("always returns an integer", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 1999, 3)];
    const subtotal = cartSubtotal(lines);
    expect(Number.isInteger(subtotal)).toBe(true);
    expect(subtotal).toBe(6027);
  });

  it("treats a zero-quantity line as contributing nothing", () => {
    expect(cartSubtotal([line("a", 1999, 0), line("b", 500, 2)])).toBe(1000);
  });
});

describe("cartTotal", () => {
  it("subtracts a discount given in cents", () => {
    const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];
    const total = cartTotal(lines, 500);
    expect(total).toBe(4748);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("returns the subtotal unchanged for a zero discount", () => {
    const lines = [line("a", 1999, 3)];
    expect(cartTotal(lines, 0)).toBe(5997);
  });

  it("is exact where float dollars would drift", () => {
    // Previously (0.1 + 0.2) - 0.1 needed rounding to charge 20 cents.
    const lines = [line("a", 10, 1), line("b", 20, 1)];
    expect(cartTotal(lines, 10)).toBe(20);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([], 0)).toBe(0);
  });

  it("clamps at 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("a", 500, 1)], 800)).toBe(0);
  });

  it("returns 0 when the discount exactly equals the subtotal", () => {
    expect(cartTotal([line("a", 500, 2)], 1000)).toBe(0);
  });

  it("clamps an empty cart with a discount to 0", () => {
    expect(cartTotal([], 250)).toBe(0);
  });
});

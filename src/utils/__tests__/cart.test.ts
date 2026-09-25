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

  it("sums 10 + 20 cents to exactly 30 (0.1 + 0.2 drifts in float dollars)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1)];

    expect(cartSubtotal(lines)).toBe(30);
  });

  it("computes 1999 x 3 as exactly 5997 (19.99 * 3 drifts in float dollars)", () => {
    expect(cartSubtotal([line("a", 1999, 3)])).toBe(5997);
  });

  it("stays exact over many small-cent lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => line(`p-${i}`, 10, 1));

    expect(cartSubtotal(lines)).toBe(100);
  });

  it("returns an integer", () => {
    const lines = [line("a", 1999, 3), line("b", 10, 1), line("c", 20, 7)];

    expect(Number.isInteger(cartSubtotal(lines))).toBe(true);
  });
});

describe("cartTotal", () => {
  const lines = [line("p-100", 1999, 2), line("p-205", 1250, 1)];

  it("subtracts a cents discount from the subtotal", () => {
    expect(cartTotal(lines, 500)).toBe(4748);
  });

  it("returns the subtotal unchanged for a zero discount", () => {
    expect(cartTotal(lines, 0)).toBe(5248);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([], 0)).toBe(0);
  });

  it("clamps to 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal(lines, 10000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal(lines, 5248)).toBe(0);
  });

  it("clamps an empty cart with a discount to 0", () => {
    expect(cartTotal([], 500)).toBe(0);
  });

  it("is exact where float dollars would drift (0.1 + 0.2 - 0.05)", () => {
    const small = [line("a", 10, 1), line("b", 20, 1)];

    expect(cartTotal(small, 5)).toBe(25);
  });

  it("returns exact cents for 1999 x 3 minus a discount", () => {
    expect(cartTotal([line("a", 1999, 3)], 1)).toBe(5996);
  });

  it("returns an integer", () => {
    expect(Number.isInteger(cartTotal([line("a", 1999, 3)], 333))).toBe(true);
  });
});

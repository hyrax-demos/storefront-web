import { describe, it, expect } from "vitest";
import { cartSubtotal, cartTotal, type CartLine } from "../cart";

function line(unitPriceCents: number, quantity: number, id = "p"): CartLine {
  return { productId: id, name: `Product ${id}`, unitPriceCents, quantity };
}

describe("cartSubtotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("sums unitPriceCents * quantity across lines", () => {
    expect(cartSubtotal([line(1999, 2, "a"), line(500, 1, "b")])).toBe(4498);
  });

  it("sums 10 cents + 20 cents to exactly 30 cents (no float drift)", () => {
    // In dollars, 0.1 + 0.2 === 0.30000000000000004.
    expect(cartSubtotal([line(10, 1, "a"), line(20, 1, "b")])).toBe(30);
  });

  it("sums three lines of 1999 cents x 3 to exactly 17991 cents", () => {
    const lines = [line(1999, 3, "a"), line(1999, 3, "b"), line(1999, 3, "c")];
    expect(cartSubtotal(lines)).toBe(17991);
  });

  it("returns an integer number of cents", () => {
    const lines = [line(10, 1, "a"), line(20, 1, "b"), line(1999, 3, "c")];
    expect(Number.isInteger(cartSubtotal(lines))).toBe(true);
  });
});

describe("cartTotal", () => {
  it("subtracts a discount given in cents", () => {
    expect(cartTotal([line(1999, 3, "a")], 600)).toBe(5397);
  });

  it("returns the subtotal unchanged with a zero discount", () => {
    expect(cartTotal([line(10, 1, "a"), line(20, 1, "b")], 0)).toBe(30);
  });

  it("returns an integer number of cents", () => {
    const total = cartTotal([line(10, 1, "a"), line(20, 1, "b")], 7);
    expect(total).toBe(23);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("clamps to 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal([line(500, 1, "a")], 1000)).toBe(0);
  });

  it("returns 0 when the discount exactly equals the subtotal", () => {
    expect(cartTotal([line(500, 2, "a")], 1000)).toBe(0);
  });

  it("charges the exact cent amount for float-trap inputs", () => {
    // Replaces the old toChargeCents conversion: the total is already exact cents.
    const lines = [line(1999, 3, "a"), line(1999, 3, "b"), line(1999, 3, "c")];
    expect(cartTotal(lines, 1)).toBe(17990);
  });
});

import { describe, it, expect } from "vitest";
import * as cart from "../cart";
import { cartSubtotal, cartTotal, type CartLine } from "../cart";

function line(
  productId: string,
  unitPriceCents: number,
  quantity = 1,
): CartLine {
  return { productId, name: productId, unitPriceCents, quantity };
}

describe("cartSubtotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("multiplies unit price by quantity", () => {
    expect(cartSubtotal([line("a", 1250, 2)])).toBe(2500);
  });

  it("sums values whose float-dollar version would drift, exactly", () => {
    // 0.1 + 0.2 + 0.3 !== 0.6 in floating point dollars.
    const subtotal = cartSubtotal([line("a", 10), line("b", 20), line("c", 30)]);
    expect(subtotal).toBe(60);
    expect(Number.isInteger(subtotal)).toBe(true);
  });

  it("stays an exact integer across many lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => line(`p${i}`, 10, 3));
    const subtotal = cartSubtotal(lines);
    expect(subtotal).toBe(300);
    expect(Number.isInteger(subtotal)).toBe(true);
  });
});

describe("cartTotal", () => {
  it("subtracts an integer-cent discount exactly", () => {
    const total = cartTotal([line("a", 1999, 3)], 899);
    expect(total).toBe(5098);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("subtracts a discount that would drift in float dollars", () => {
    // 0.3 - 0.1 in dollars is 0.19999999999999998.
    expect(cartTotal([line("a", 10), line("b", 20)], 10)).toBe(20);
  });

  it("returns the subtotal when the discount is 0", () => {
    expect(cartTotal([line("a", 1250, 2)], 0)).toBe(2500);
  });

  it("clamps at 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("a", 500)], 1000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal([line("a", 500)], 500)).toBe(0);
  });
});

describe("module exports", () => {
  it("no longer exports toChargeCents", () => {
    expect("toChargeCents" in cart).toBe(false);
  });
});

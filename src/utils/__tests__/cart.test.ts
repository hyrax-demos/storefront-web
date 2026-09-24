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

  it("multiplies unit cents by quantity and sums the lines", () => {
    const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];

    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("sums 1999 × 3 to exactly 5997", () => {
    expect(cartSubtotal([line("tee", 1999, 3)])).toBe(5997);
  });

  it("sums 10 + 20 + 30 cents to exactly 60 (no 0.1 + 0.2 float error)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];
    const subtotal = cartSubtotal(lines);

    expect(subtotal).toBe(60);
    expect(Number.isInteger(subtotal)).toBe(true);
  });

  it("stays exact across many lines at 1999 × qty", () => {
    const lines: CartLine[] = [];
    let expected = 0;
    for (let i = 1; i <= 100; i++) {
      lines.push(line(`p-${i}`, 1999, i));
      expected += 1999 * i;
    }
    const subtotal = cartSubtotal(lines);

    // 1999 × (1 + 2 + … + 100) = 1999 × 5050
    expect(expected).toBe(10_094_950);
    expect(subtotal).toBe(10_094_950);
    expect(Number.isInteger(subtotal)).toBe(true);
  });
});

describe("cartTotal", () => {
  it("subtracts a cents discount from the subtotal exactly", () => {
    const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];
    const total = cartTotal(lines, 525);

    expect(total).toBe(4723);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("returns the subtotal unchanged when the discount is 0", () => {
    expect(cartTotal([line("tee", 1999, 3)], 0)).toBe(5997);
  });

  it("never drops below zero when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("tee", 1999, 1)], 5000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal([line("tee", 1999, 1)], 1999)).toBe(0);
  });

  it("yields the exact charge amount in cents for float-prone prices", () => {
    // $0.10 + $0.20 − $0.01 used to need dollar rounding before charging;
    // in cents it is simply 29.
    const lines = [line("a", 10, 1), line("b", 20, 1)];
    const total = cartTotal(lines, 1);

    expect(total).toBe(29);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("returns a cents value the payment API can take directly (e.g. 1999 for $19.99)", () => {
    const total = cartTotal([line("tee", 1999, 1)], 0);

    expect(total).toBe(1999);
    expect(Number.isInteger(total)).toBe(true);
  });
});

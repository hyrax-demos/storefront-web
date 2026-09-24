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

  it("multiplies unit price cents by quantity", () => {
    expect(cartSubtotal([line("a", 1999, 3)])).toBe(5997);
  });

  it("sums multiple lines exactly", () => {
    expect(cartSubtotal([line("a", 1999, 2), line("b", 1250, 1)])).toBe(5248);
  });

  it("sums 10 + 20 + 30 cents to exactly 60 (no 0.1 + 0.2 float error)", () => {
    const total = cartSubtotal([
      line("a", 10, 1),
      line("b", 20, 1),
      line("c", 30, 1),
    ]);
    expect(total).toBe(60);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("stays exact across many lines of 1999 × qty", () => {
    const lines: CartLine[] = [];
    let expected = 0;
    for (let i = 1; i <= 100; i++) {
      lines.push(line(`p-${i}`, 1999, i));
      expected += 1999 * i;
    }
    const total = cartSubtotal(lines);
    expect(total).toBe(expected);
    expect(total).toBe(10_094_950);
    expect(Number.isInteger(total)).toBe(true);
  });
});

describe("cartTotal", () => {
  it("subtracts a cents discount from the subtotal exactly", () => {
    const total = cartTotal([line("a", 1999, 2), line("b", 1250, 1)], 525);
    expect(total).toBe(4723);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("returns the subtotal when the discount is 0", () => {
    expect(cartTotal([line("a", 1999, 3)], 0)).toBe(5997);
  });

  it("never drops below 0", () => {
    expect(cartTotal([line("a", 500, 1)], 1000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal([line("a", 500, 2)], 1000)).toBe(0);
  });

  // Replaces the removed toChargeCents conversion: the charge amount now
  // comes straight out of cartTotal as the exact integer cents value that
  // Math.round(19.99 * 100) used to produce.
  it("yields the exact chargeable cents without a dollar→cents conversion", () => {
    const total = cartTotal([line("a", 1999, 1)], 0);
    expect(total).toBe(1999);
    expect(Number.isInteger(total)).toBe(true);
  });
});

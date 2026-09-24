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

  it("sums multiple lines in exact cents", () => {
    const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];
    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("sums 10 + 20 + 30 cents to exactly 60 (no 0.1 + 0.2 float error)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];
    const subtotal = cartSubtotal(lines);
    expect(subtotal).toBe(60);
    expect(Number.isInteger(subtotal)).toBe(true);
  });

  it("stays exact across many 1999-cent lines", () => {
    const lines = Array.from({ length: 100 }, (_, i) =>
      line(`p-${i}`, 1999, i + 1),
    );
    // 1999 * (1 + 2 + ... + 100) = 1999 * 5050
    const subtotal = cartSubtotal(lines);
    expect(subtotal).toBe(10_094_950);
    expect(Number.isInteger(subtotal)).toBe(true);
  });
});

describe("cartTotal", () => {
  const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];

  it("returns the subtotal when there is no discount", () => {
    expect(cartTotal(lines, 0)).toBe(5248);
  });

  it("subtracts a cents discount exactly", () => {
    const total = cartTotal(lines, 787);
    expect(total).toBe(4461);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("never goes below zero", () => {
    expect(cartTotal(lines, 10_000)).toBe(0);
    expect(cartTotal(lines, 5248)).toBe(0);
  });

  it("returns the exact chargeable cents for a 19.99 item (formerly toChargeCents)", () => {
    // 19.99 * 100 in floats is 1998.9999999999998; in cents it is exact.
    expect(cartTotal([line("a", 1999, 1)], 0)).toBe(1999);
  });

  it("keeps 0.1 + 0.2 style totals exact after a discount", () => {
    const total = cartTotal(
      [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)],
      15,
    );
    expect(total).toBe(45);
    expect(Number.isInteger(total)).toBe(true);
  });
});

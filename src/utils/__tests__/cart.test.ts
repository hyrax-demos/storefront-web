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
    const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];
    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("is exact where float dollars would drift (10c + 20c = 30c)", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in float dollars.
    const lines = [line("a", 10, 1), line("b", 20, 1)];
    expect(cartSubtotal(lines)).toBe(30);
  });

  it("is exact for 1999 x 3 = 5997 cents", () => {
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
  const lines = [line("tee", 1999, 2), line("tote", 1250, 1)]; // 5248

  it("subtracts a cents discount from the subtotal", () => {
    const total = cartTotal(lines, 1000);
    expect(total).toBe(4248);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("returns the subtotal when the discount is zero", () => {
    expect(cartTotal(lines, 0)).toBe(5248);
  });

  it("is exact where float dollars would drift", () => {
    // 10c + 20c - 10c: float dollars give 0.20000000000000004.
    expect(cartTotal([line("a", 10, 1), line("b", 20, 1)], 10)).toBe(20);
    // 1999 x 3 - 1 cent
    expect(cartTotal([line("a", 1999, 3)], 1)).toBe(5996);
  });

  it("clamps to 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal(lines, 10000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal(lines, 5248)).toBe(0);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([], 0)).toBe(0);
    expect(cartTotal([], 500)).toBe(0);
  });
});

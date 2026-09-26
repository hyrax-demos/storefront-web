import { describe, it, expect } from "vitest";
import {
  cartSubtotal,
  cartSubtotalCents,
  cartTotal,
  toChargeCents,
  type CartLine,
} from "../cart";

function line(productId: string, unitPrice: number, quantity = 1): CartLine {
  return { productId, name: productId, unitPrice, quantity };
}

describe("cartSubtotal", () => {
  it("sums 0.1 + 0.2 to exactly 0.3", () => {
    const lines = [line("a", 0.1), line("b", 0.2)];

    expect(0.1 + 0.2).not.toBe(0.3);
    expect(cartSubtotal(lines)).toBe(0.3);
    expect(cartSubtotalCents(lines)).toBe(30);
  });

  it("rounds a half-cent price up where float toFixed rounds it down", () => {
    // (1.005).toFixed(2) === "1.00" because 1.005 is stored as 1.00499999...
    expect(Number((1.005).toFixed(2))).toBe(1);
    expect(cartSubtotal([line("a", 1.005)])).toBe(1.01);
  });

  it("multiplies quantities in cents", () => {
    expect(cartSubtotal([line("a", 19.99, 3), line("b", 0.07, 10)])).toBe(
      60.67,
    );
  });

  it("is zero for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartTotal", () => {
  it("subtracts the discount exactly", () => {
    expect(cartTotal([line("a", 0.3)], 0.1)).toBe(0.2);
  });

  it("floors the total at zero when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("a", 5)], 10)).toBe(0);
  });

  it("returns zero when the discount equals the subtotal", () => {
    expect(cartTotal([line("a", 0.1), line("b", 0.2)], 0.3)).toBe(0);
  });
});

describe("toChargeCents", () => {
  it("converts dollars to integer cents", () => {
    expect(toChargeCents(19.99)).toBe(1999);
    expect(toChargeCents(0)).toBe(0);
  });

  it("absorbs float noise from the input", () => {
    expect(toChargeCents(0.1 + 0.2)).toBe(30);
  });

  it("rounds a half cent up rather than losing it to float error", () => {
    // 1.005 * 100 === 100.49999999999999, which a bare Math.round drops.
    expect(toChargeCents(1.005)).toBe(101);
  });

  it("round-trips a cart total", () => {
    const total = cartTotal([line("a", 19.99, 3), line("b", 0.07, 10)], 5.5);
    expect(toChargeCents(total)).toBe(5517);
  });
});

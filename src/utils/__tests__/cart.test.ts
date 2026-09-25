import { describe, it, expect } from "vitest";
import * as cart from "../cart";
import { cartSubtotal, cartTotal, type CartLine } from "../cart";

function line(unitPriceCents: number, quantity = 1, id = "p"): CartLine {
  return { productId: id, name: id, unitPriceCents, quantity };
}

describe("cartSubtotal (integer cents)", () => {
  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("sums unitPriceCents * quantity exactly", () => {
    const lines = [line(1999, 2, "tee"), line(1250, 1, "tote")];
    expect(cartSubtotal(lines)).toBe(5248);
  });

  // Came from the removed toChargeCents behaviour: 0.1 + 0.2 dollars had to
  // charge exactly 30 cents. In cents the sum is exact with no conversion.
  it("sums 10 and 20 cents to exactly 30", () => {
    const subtotal = cartSubtotal([line(10), line(20)]);
    expect(subtotal).toBe(30);
    expect(Number.isInteger(subtotal)).toBe(true);
  });

  // Came from the removed toChargeCents behaviour: $19.99 had to become 1999
  // cents (not 1998 from 1998.9999999999998).
  it("keeps a 1999-cent line exactly 1999", () => {
    expect(cartSubtotal([line(1999)])).toBe(1999);
  });

  it("sums many small-priced lines exactly", () => {
    const lines = Array.from({ length: 10 }, (_, i) => line(10, 3, `p${i}`));
    const subtotal = cartSubtotal(lines);
    expect(subtotal).toBe(300);
    expect(Number.isInteger(subtotal)).toBe(true);
  });
});

describe("cartTotal (integer cents)", () => {
  const lines = [line(1999, 2, "tee"), line(1250, 1, "tote")];

  it("returns the subtotal when there is no discount", () => {
    expect(cartTotal(lines, 0)).toBe(5248);
  });

  it("subtracts an integer-cent discount exactly", () => {
    const total = cartTotal(lines, 525);
    expect(total).toBe(4723);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("subtracts a 1-cent discount exactly", () => {
    expect(cartTotal([line(10), line(20)], 1)).toBe(29);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal(lines, 5248)).toBe(0);
  });

  it("clamps at 0 when the discount exceeds the subtotal", () => {
    expect(cartTotal(lines, 10000)).toBe(0);
  });
});

describe("cart module exports", () => {
  it("no longer exports toChargeCents", () => {
    expect("toChargeCents" in cart).toBe(false);
  });
});

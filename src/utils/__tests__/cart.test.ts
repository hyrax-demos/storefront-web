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

  it("multiplies unit price by quantity in integer cents", () => {
    expect(cartSubtotal([line("tee", 1999, 3)])).toBe(5997);
  });

  it("sums lines that float dollars would get wrong (0.1 + 0.2 + 0.3)", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];
    expect(cartSubtotal(lines)).toBe(60);
  });

  it("sums a mixed cart exactly", () => {
    const lines = [line("tee", 1999, 2), line("tote", 1250, 1)];
    expect(cartSubtotal(lines)).toBe(5248);
  });

  it("returns an integer number of cents", () => {
    const lines = [line("a", 10, 1), line("b", 20, 1), line("tee", 1999, 3)];
    expect(Number.isInteger(cartSubtotal(lines))).toBe(true);
  });
});

describe("cartTotal", () => {
  it("returns 0 for an empty cart with no discount", () => {
    expect(cartTotal([], 0)).toBe(0);
  });

  it("subtracts a cents discount exactly", () => {
    expect(cartTotal([line("tee", 1999, 3)], 600)).toBe(5397);
  });

  it("returns the subtotal unchanged when the discount is 0", () => {
    expect(cartTotal([line("tee", 1999, 3)], 0)).toBe(5997);
  });

  it("clamps at zero when the discount exceeds the subtotal", () => {
    expect(cartTotal([line("mug", 500, 1)], 1000)).toBe(0);
  });

  it("returns 0 when the discount equals the subtotal", () => {
    expect(cartTotal([line("mug", 500, 1)], 500)).toBe(0);
  });

  it("returns an integer number of cents chargeable as-is", () => {
    // Previously guaranteed by toChargeCents: the amount sent to the payment
    // API is an integer number of cents.
    const lines = [line("a", 10, 1), line("b", 20, 1), line("c", 30, 1)];
    const total = cartTotal(lines, 15);
    expect(total).toBe(45);
    expect(Number.isInteger(total)).toBe(true);
    expect(Number.isInteger(cartTotal([line("tee", 1999, 3)], 600))).toBe(
      true,
    );
  });
});

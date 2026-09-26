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

  describe("with a flat number discount", () => {
    it("subtracts a dollar amount in cents", () => {
      expect(cartTotal([line("a", 19.99, 3), line("b", 0.07, 10)], 5.5)).toBe(
        55.17,
      );
    });

    it("treats a zero discount as no discount", () => {
      expect(cartTotal([line("a", 1.005)], 0)).toBe(1.01);
    });
  });

  describe("with a percentage discount object", () => {
    it("takes a percentage off the subtotal", () => {
      expect(
        cartTotal([line("a", 50), line("b", 50)], { percentOff: 10 }),
      ).toBe(90);
    });

    it("rounds a half-cent discount up in cents", () => {
      // 10% of $100.05 is 1000.5 cents -> 1001 cents off.
      expect(cartTotal([line("a", 100.05)], { percentOff: 10 })).toBe(90.04);
    });

    it("does not lose a cent to float noise", () => {
      // 5% of 10010 cents is 500.5, which float math yields as 500.49999...
      expect(cartTotal([line("a", 100.1)], { percentOff: 5 })).toBe(95.09);
    });

    it("sums float-y lines exactly before applying the percentage", () => {
      expect(
        cartTotal([line("a", 0.1), line("b", 0.2)], { percentOff: 50 }),
      ).toBe(0.15);
    });

    it("returns zero for a 100% discount", () => {
      expect(cartTotal([line("a", 12.34)], { percentOff: 100 })).toBe(0);
    });

    it("floors the total at zero when the percentage exceeds 100", () => {
      expect(cartTotal([line("a", 12.34)], { percentOff: 150 })).toBe(0);
    });

    it("leaves the total unchanged for 0% off", () => {
      expect(cartTotal([line("a", 12.34)], { percentOff: 0 })).toBe(12.34);
    });
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

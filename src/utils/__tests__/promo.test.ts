import { describe, it, expect } from "vitest";
import { applyPromoRule, type PromoRule } from "../promo";

describe("applyPromoRule", () => {
  const rule: PromoRule = { minSubtotal: 5000, percentOff: 10 };

  it("returns 0 below the cents threshold", () => {
    expect(applyPromoRule(rule, 4000)).toBe(0);
  });

  it("applies the percentage above the threshold, in cents", () => {
    // $120.00 subtotal, 10% off -> $12.00
    expect(applyPromoRule(rule, 12000)).toBe(1200);
  });

  describe("threshold boundary", () => {
    it("gives the discount at exactly minSubtotal", () => {
      expect(applyPromoRule(rule, 5000)).toBe(500);
    });

    it("gives 0 at minSubtotal - 1", () => {
      expect(applyPromoRule(rule, 4999)).toBe(0);
    });
  });

  describe("half-up rounding", () => {
    const five: PromoRule = { minSubtotal: 0, percentOff: 5 };
    const ten: PromoRule = { minSubtotal: 0, percentOff: 10 };

    it("rounds 0.5 up to 1 (5% of 10)", () => {
      expect(applyPromoRule(five, 10)).toBe(1);
    });

    it("rounds 1.5 up to 2 (5% of 30)", () => {
      expect(applyPromoRule(five, 30)).toBe(2);
    });

    it("rounds 2.5 up to 3, not to even (5% of 50)", () => {
      expect(applyPromoRule(five, 50)).toBe(3);
    });

    it("rounds 100.5 up to 101 (10% of 1005)", () => {
      expect(applyPromoRule(ten, 1005)).toBe(101);
    });

    it("rounds a non-half fraction down (10% of 1004 -> 100)", () => {
      expect(applyPromoRule(ten, 1004)).toBe(100);
    });

    it("rounds exact half cents up for fractional percents (12.5% of 4 -> 1)", () => {
      // 12.5% of 4 = 0.5
      expect(applyPromoRule({ minSubtotal: 0, percentOff: 12.5 }, 4)).toBe(1);
      // 12.5% of 12 = 1.5
      expect(applyPromoRule({ minSubtotal: 0, percentOff: 12.5 }, 12)).toBe(2);
    });
  });

  it("always returns an integer", () => {
    const cases: Array<[PromoRule, number]> = [
      [{ minSubtotal: 0, percentOff: 7 }, 1999],
      [{ minSubtotal: 0, percentOff: 33 }, 101],
      [{ minSubtotal: 0, percentOff: 12.5 }, 777],
      [{ minSubtotal: 5000, percentOff: 10 }, 4999],
      [{ minSubtotal: 5000, percentOff: 15 }, 12345],
    ];
    for (const [r, subtotal] of cases) {
      expect(Number.isInteger(applyPromoRule(r, subtotal))).toBe(true);
    }
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 7 }, 1999)).toBe(140);
  });
});

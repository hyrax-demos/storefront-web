import { describe, it, expect } from "vitest";
import { applyPromoRule, type PromoRule } from "../promo";

// $100.00 threshold, 10% off.
const TEN_OFF_OVER_100: PromoRule = { minSubtotal: 10000, percentOff: 10 };

describe("applyPromoRule threshold (integer cents)", () => {
  it("gives 0 when the subtotal is one cent below the threshold", () => {
    expect(applyPromoRule(TEN_OFF_OVER_100, 9999)).toBe(0);
  });

  it("gives the discount when the subtotal is exactly at the threshold", () => {
    expect(applyPromoRule(TEN_OFF_OVER_100, 10000)).toBe(1000);
  });

  it("gives the discount when the subtotal is above the threshold", () => {
    expect(applyPromoRule(TEN_OFF_OVER_100, 10001)).toBe(1000);
    expect(applyPromoRule(TEN_OFF_OVER_100, 25000)).toBe(2500);
  });

  it("applies to any subtotal when the threshold is 0", () => {
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 1999)).toBe(200);
  });

  it("gives 0 for an empty (0-cent) cart", () => {
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 0)).toBe(0);
  });
});

describe("applyPromoRule rounding (half up to the nearest cent)", () => {
  const rule = (percentOff: number): PromoRule => ({
    minSubtotal: 0,
    percentOff,
  });

  it("rounds an exact half cent up: 15% of 1010 = 151.5 -> 152", () => {
    expect(applyPromoRule(rule(15), 1010)).toBe(152);
  });

  it("rounds an exact half cent up where half-to-even would round down: 152.5 -> 153", () => {
    // 50% of 305 cents = 152.5
    expect(applyPromoRule(rule(50), 305)).toBe(153);
  });

  it("rounds an exact half cent up: 50% of 1 cent = 0.5 -> 1", () => {
    expect(applyPromoRule(rule(50), 1)).toBe(1);
  });

  it("rounds an exact half cent up with a fractional percent: 12.5% of 3604 = 450.5 -> 451", () => {
    expect(applyPromoRule(rule(12.5), 3604)).toBe(451);
  });

  it("rounds a .4 fraction down: 10% of 1234 = 123.4 -> 123", () => {
    expect(applyPromoRule(rule(10), 1234)).toBe(123);
  });

  it("rounds a .6 fraction up: 10% of 1236 = 123.6 -> 124", () => {
    expect(applyPromoRule(rule(10), 1236)).toBe(124);
  });

  it("is not thrown off by float error in the percent (7% of 1999 = 139.93 -> 140)", () => {
    // In dollar floats 19.99 * 0.07 = 1.3993000000000002.
    expect(applyPromoRule(rule(7), 1999)).toBe(140);
  });

  it("always returns an integer number of cents", () => {
    const percents = [0, 1, 7, 10, 12.5, 15, 33, 50, 99.9, 100];
    for (const p of percents) {
      for (let subtotal = 0; subtotal <= 2000; subtotal += 7) {
        const discount = applyPromoRule(rule(p), subtotal);
        expect(Number.isInteger(discount)).toBe(true);
      }
    }
  });
});

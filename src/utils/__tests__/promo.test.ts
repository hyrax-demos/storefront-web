import { describe, it, expect } from "vitest";
import { applyPromoRule, type PromoRule } from "../promo";

const tenOffOver50: PromoRule = { minSubtotal: 5000, percentOff: 10 };

describe("applyPromoRule threshold (cents)", () => {
  it("returns 0 for a subtotal well below the threshold", () => {
    expect(applyPromoRule(tenOffOver50, 4999)).toBe(0);
    expect(applyPromoRule(tenOffOver50, 0)).toBe(0);
  });

  it("returns 0 one cent below the threshold", () => {
    expect(applyPromoRule(tenOffOver50, 4999)).toBe(0);
  });

  it("applies the discount exactly at the threshold", () => {
    expect(applyPromoRule(tenOffOver50, 5000)).toBe(500);
  });

  it("applies the discount above the threshold", () => {
    expect(applyPromoRule(tenOffOver50, 5001)).toBe(500);
    expect(applyPromoRule(tenOffOver50, 12345)).toBe(1235); // 1234.5 → 1235
  });

  it("applies when the threshold is 0", () => {
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 20 }, 1000)).toBe(200);
  });
});

describe("applyPromoRule half-up rounding", () => {
  const rule = (percentOff: number): PromoRule => ({ minSubtotal: 0, percentOff });

  it("rounds an exact half cent up (10% of 1005 = 100.5 → 101)", () => {
    expect(applyPromoRule(rule(10), 1005)).toBe(101);
  });

  it("rounds below a half cent down (15% of 1003 = 150.45 → 150)", () => {
    expect(applyPromoRule(rule(15), 1003)).toBe(150);
  });

  it("rounds 150.5-style half cents up", () => {
    expect(applyPromoRule(rule(50), 301)).toBe(151); // 150.5
    expect(applyPromoRule(rule(5), 3010)).toBe(151); // 150.5
    expect(applyPromoRule(rule(10), 1504)).toBe(150); // 150.4
    expect(applyPromoRule(rule(10), 1506)).toBe(151); // 150.6
  });

  it("rounds half up, not half to even", () => {
    // 100.5 and 101.5 both round up; half-to-even would give 100 and 102.
    expect(applyPromoRule(rule(50), 201)).toBe(101); // 100.5
    expect(applyPromoRule(rule(50), 203)).toBe(102); // 101.5
    expect(applyPromoRule(rule(50), 1)).toBe(1); // 0.5
  });

  it("handles fractional percents exactly (12.5% of 804 = 100.5 → 101)", () => {
    expect(applyPromoRule(rule(12.5), 804)).toBe(101);
    expect(applyPromoRule(rule(12.5), 800)).toBe(100);
  });

  it("gives 0 for 0% and the full subtotal for 100%", () => {
    expect(applyPromoRule(rule(0), 1999)).toBe(0);
    expect(applyPromoRule(rule(100), 1999)).toBe(1999);
  });
});

describe("applyPromoRule exactness", () => {
  it("always returns an integer number of cents", () => {
    for (const percentOff of [0, 1, 7, 10, 12.5, 15, 33, 50, 99.99, 100]) {
      for (let subtotal = 0; subtotal <= 2000; subtotal += 7) {
        const d = applyPromoRule({ minSubtotal: 0, percentOff }, subtotal);
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(subtotal);
      }
    }
  });

  it("is exact where float dollars would have drifted", () => {
    // In dollars, 10.70 * 0.15 === 1.6049999999999998, which rounds to 1.60.
    // The exact value is 1.605 → half up to 161 cents.
    expect(10.7 * 0.15).not.toBe(1.605);
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 15 }, 1070)).toBe(161);
    // 3.01 * 0.5 toFixed(2) gives "1.50"; exact 1.505 → 151 cents.
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 50 }, 301)).toBe(151);
  });
});

import { describe, it, expect } from "vitest";
import { applyPromoRule, type PromoRule } from "../promo";

const tenPctOver50: PromoRule = { minSubtotal: 5000, percentOff: 10 };
const tenPct: PromoRule = { minSubtotal: 0, percentOff: 10 };

describe("applyPromoRule threshold (cents)", () => {
  it("returns 0 when the subtotal is one cent below the threshold", () => {
    expect(applyPromoRule(tenPctOver50, 4999)).toBe(0);
  });

  it("applies the discount when the subtotal equals the threshold", () => {
    expect(applyPromoRule(tenPctOver50, 5000)).toBe(500);
  });

  it("applies the discount when the subtotal is one cent above the threshold", () => {
    // 10% of 5001 = 500.1 -> 500
    expect(applyPromoRule(tenPctOver50, 5001)).toBe(500);
  });

  it("returns 0 for an empty (0 cent) subtotal below a positive threshold", () => {
    expect(applyPromoRule(tenPctOver50, 0)).toBe(0);
  });
});

describe("applyPromoRule half-up rounding (cents)", () => {
  it.each([
    [5, 1], // 0.5 -> 1
    [15, 2], // 1.5 -> 2
    [25, 3], // 2.5 -> 3 (half-even would give 2)
    [14, 1], // 1.4 -> 1 (below half)
    [16, 2], // 1.6 -> 2 (above half)
  ])("10%% of %i cents is %i cents", (subtotal, expected) => {
    const discount = applyPromoRule(tenPct, subtotal);
    expect(discount).toBe(expected);
    expect(Number.isInteger(discount)).toBe(true);
  });

  it("is exact where float math would drift (10% of 1999 cents = 199.9 -> 200)", () => {
    const discount = applyPromoRule(tenPct, 1999);
    expect(discount).toBe(200);
    expect(Number.isInteger(discount)).toBe(true);
  });

  it("rounds a fractional percent half up exactly (12.5% of 4 cents = 0.5 -> 1)", () => {
    const discount = applyPromoRule({ minSubtotal: 0, percentOff: 12.5 }, 4);
    expect(discount).toBe(1);
    expect(Number.isInteger(discount)).toBe(true);
  });
});

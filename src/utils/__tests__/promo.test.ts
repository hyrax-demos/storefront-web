import { describe, it, expect } from "vitest";
import { applyPromoRule, type PromoRule } from "../promo";

const tenOffOver100: PromoRule = { minSubtotal: 100, percentOff: 10 };

describe("applyPromoRule threshold", () => {
  it("returns 0 below the threshold", () => {
    expect(applyPromoRule(tenOffOver100, 99.99)).toBe(0);
  });

  it("applies the discount when the subtotal is exactly minSubtotal", () => {
    expect(applyPromoRule(tenOffOver100, 100)).toBe(10);
  });

  it("treats a float-noisy subtotal equal to minSubtotal as qualifying", () => {
    // 0.3 + 0.6 === 0.8999999999999999 in floats.
    const noisy = 0.3 + 0.6;
    expect(noisy).toBeLessThan(0.9);
    expect(applyPromoRule({ minSubtotal: 0.9, percentOff: 50 }, noisy)).toBe(
      0.45,
    );
  });

  it("applies the discount above the threshold", () => {
    expect(applyPromoRule(tenOffOver100, 150)).toBe(15);
  });

  it("applies to any subtotal when minSubtotal is 0", () => {
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 0)).toBe(0);
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 5)).toBe(0.5);
  });
});

describe("applyPromoRule rounding", () => {
  it("rounds a half-cent discount up where float toFixed rounds it down", () => {
    // 100.1 * 0.05 === 5.005 in floats, and (5.005).toFixed(2) === "5.00".
    expect(Number((100.1 * 0.05).toFixed(2))).toBe(5);
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 5 }, 100.1)).toBe(5.01);
  });

  it("rounds 1.005 up to 1.01", () => {
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 50 }, 2.01)).toBe(1.01);
  });

  it("rounds a half cent up when float math lands just below it", () => {
    // 1.15 * 0.1 === 0.11499999999999999 in floats.
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 1.15)).toBe(0.12);
  });

  it("rounds below a half cent down", () => {
    // 10.04 * 10% = 1.004
    expect(applyPromoRule(tenOffOver100, 100.04)).toBe(10);
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 10.04)).toBe(1);
  });

  it("supports fractional percentages", () => {
    // 19.99 * 12.5% = 2.49875 -> 2.50
    expect(applyPromoRule({ minSubtotal: 0, percentOff: 12.5 }, 19.99)).toBe(
      2.5,
    );
  });

  it("returns exact cent values with no float noise", () => {
    const discount = applyPromoRule({ minSubtotal: 0, percentOff: 10 }, 0.3);
    expect(discount).toBe(0.03);
  });
});

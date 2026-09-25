import { describe, it, expect } from "vitest";
import { dollarsToCents, formatCents } from "../money";

describe("dollarsToCents", () => {
  it("converts catalog dollar prices to exact integer cents", () => {
    // 0.1 * 100, 19.99 * 100 and 1.1 * 100 are all inexact in floating point.
    expect(dollarsToCents(0.1)).toBe(10);
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(1.1)).toBe(110);
    expect(dollarsToCents(0.29)).toBe(29);
    expect(dollarsToCents(12.5)).toBe(1250);
    expect(dollarsToCents(0)).toBe(0);
  });

  it("always returns an integer", () => {
    for (const d of [0.07, 0.57, 1.15, 4.35, 8.2, 99.99]) {
      expect(Number.isInteger(dollarsToCents(d))).toBe(true);
    }
  });
});

describe("formatCents", () => {
  it("formats cents as a 2-decimal dollar string", () => {
    expect(formatCents(1999)).toBe("19.99");
    expect(formatCents(5000)).toBe("50.00");
    expect(formatCents(110)).toBe("1.10");
    expect(formatCents(5)).toBe("0.05");
    expect(formatCents(0)).toBe("0.00");
  });

  it("handles negative amounts", () => {
    expect(formatCents(-250)).toBe("-2.50");
    expect(formatCents(-5)).toBe("-0.05");
  });
});

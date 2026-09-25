import { describe, it, expect } from "vitest";
import { dollarsToCents } from "../money";

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(5)).toBe(500);
    expect(dollarsToCents(50)).toBe(5000);
  });

  it("converts prices that are not exact in binary floating point", () => {
    // 19.99 * 100 === 1998.9999999999998
    expect(dollarsToCents(19.99)).toBe(1999);
    // 1.1 * 100 === 110.00000000000001
    expect(dollarsToCents(1.1)).toBe(110);
    expect(dollarsToCents(12.5)).toBe(1250);
  });

  it("absorbs float drift from dollar arithmetic", () => {
    // 0.1 + 0.2 === 0.30000000000000004
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it("always returns an integer", () => {
    for (const d of [0.01, 0.07, 19.99, 1.1, 0.1 + 0.2, 123.45, 999.99]) {
      expect(Number.isInteger(dollarsToCents(d))).toBe(true);
    }
  });
});

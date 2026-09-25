import { describe, it, expect } from "vitest";
import { dollarsToCents, formatCents } from "../money";

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

describe("formatCents", () => {
  it("formats integer cents with two decimals", () => {
    expect(formatCents(1999)).toBe("19.99");
    expect(formatCents(1250)).toBe("12.50");
    expect(formatCents(4723)).toBe("47.23");
    expect(formatCents(500)).toBe("5.00");
  });

  it("pads sub-dollar amounts", () => {
    expect(formatCents(0)).toBe("0.00");
    expect(formatCents(1)).toBe("0.01");
    expect(formatCents(10)).toBe("0.10");
    expect(formatCents(99)).toBe("0.99");
  });

  it("formats large amounts without float drift", () => {
    expect(formatCents(123456789)).toBe("1234567.89");
    expect(formatCents(100000)).toBe("1000.00");
  });

  it("round-trips dollarsToCents for catalog prices", () => {
    for (const d of [19.99, 1.1, 12.5, 0.07, 999.99]) {
      expect(formatCents(dollarsToCents(d))).toBe(d.toFixed(2));
    }
  });
});

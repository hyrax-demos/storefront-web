import { describe, it, expect } from "vitest";
import {
  convertFromUsd,
  formatMoney,
  SUPPORTED_CURRENCIES,
} from "../currency";

describe("convertFromUsd", () => {
  it("returns the same amount for USD", () => {
    expect(SUPPORTED_CURRENCIES).toContain("USD");
    expect(convertFromUsd(100, "USD")).toBe(100);
    expect(convertFromUsd(12.34, "USD")).toBe(12.34);
  });

  it("converts to EUR using the table rate", () => {
    expect(convertFromUsd(100, "EUR")).toBeCloseTo(92, 10);
  });

  it("converts to GBP using the table rate", () => {
    expect(convertFromUsd(100, "GBP")).toBeCloseTo(79, 10);
  });

  it("throws an Error for an unknown currency code", () => {
    expect(() => convertFromUsd(10, "XYZ")).toThrow(Error);
  });

  it("throws an Error for an empty currency code", () => {
    expect(() => convertFromUsd(10, "")).toThrow(Error);
  });

  it("throws for inherited object keys rather than returning NaN", () => {
    expect(() => convertFromUsd(10, "toString")).toThrow(Error);
  });
});

describe("formatMoney", () => {
  it("formats small USD amounts with two decimals", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
  });

  it("formats large USD amounts with a thousands separator", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats non-USD currencies like Intl.NumberFormat en-US", () => {
    for (const currency of ["EUR", "GBP"]) {
      const expected = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(1234.5);
      expect(formatMoney(1234.5, currency)).toBe(expected);
    }
  });
});

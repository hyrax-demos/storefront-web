import { describe, it, expect } from "vitest";
import { convertFromUsd, formatMoney } from "../currency";

describe("convertFromUsd", () => {
  it("converts a USD amount into a supported non-USD currency using the rate table", () => {
    // EUR rate is 0.92, GBP rate is 0.79.
    expect(convertFromUsd(100, "EUR")).toBeCloseTo(92, 10);
    expect(convertFromUsd(100, "GBP")).toBeCloseTo(79, 10);
  });

  it("returns the same amount for USD", () => {
    expect(convertFromUsd(42.5, "USD")).toBe(42.5);
  });

  it("throws an Error for a currency code not in the rate table", () => {
    expect(() => convertFromUsd(10, "ZZZ")).toThrow(Error);
  });

  it("throws an Error for an empty currency code", () => {
    expect(() => convertFromUsd(10, "")).toThrow(Error);
  });
});

describe("formatMoney", () => {
  it("formats a small amount with two decimal places", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
  });

  it("formats a large amount with a thousands separator", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });
});

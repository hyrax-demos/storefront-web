import { describe, it, expect } from "vitest";
import { RATES, convertFromUsd, formatMoney } from "../currency";

describe("RATES", () => {
  it("keeps the existing currency codes and rates", () => {
    expect(RATES).toEqual({ USD: 1, EUR: 0.92, GBP: 0.79 });
  });
});

describe("convertFromUsd", () => {
  it("multiplies the USD amount by the currency rate", () => {
    expect(convertFromUsd(100, "USD")).toBe(100);
    expect(convertFromUsd(100, "EUR")).toBeCloseTo(92);
    expect(convertFromUsd(100, "GBP")).toBeCloseTo(79);
  });

  it("throws an Error naming the code for unknown currencies", () => {
    expect(() => convertFromUsd(1, "JPY")).toThrow(Error);
    expect(() => convertFromUsd(1, "JPY")).toThrow(/JPY/);
    expect(() => convertFromUsd(1, "")).toThrow(Error);
    expect(() => convertFromUsd(1, "toString")).toThrow(/toString/);
    expect(() => convertFromUsd(1, "constructor")).toThrow(Error);
  });
});

describe("formatMoney", () => {
  it("formats with en-US Intl currency formatting", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(92, "EUR")).toBe("€92.00");
    expect(formatMoney(79, "GBP")).toBe("£79.00");
  });
});

import { describe, it, expect } from "vitest";
import {
  convertFromUsd,
  formatMoney,
  SUPPORTED_CURRENCIES,
} from "../currency";

describe("convertFromUsd", () => {
  it("returns the amount unchanged for USD", () => {
    expect(convertFromUsd(100, "USD")).toBe(100);
  });

  it("converts USD to EUR using the 0.92 rate", () => {
    expect(convertFromUsd(100, "EUR")).toBeCloseTo(92, 10);
    expect(convertFromUsd(12.5, "EUR")).toBeCloseTo(11.5, 10);
  });

  it("converts USD to GBP using the 0.79 rate", () => {
    expect(convertFromUsd(100, "GBP")).toBeCloseTo(79, 10);
    expect(convertFromUsd(50, "GBP")).toBeCloseTo(39.5, 10);
  });

  it("converts zero to zero for every supported currency", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(convertFromUsd(0, currency)).toBe(0);
    }
  });

  it("exposes exactly the currencies in the rate table", () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual(["USD", "EUR", "GBP"]);
  });

  it("throws an Error for an unsupported currency code", () => {
    expect(() => convertFromUsd(100, "JPY")).toThrow(Error);
    expect(() => convertFromUsd(100, "JPY")).toThrow(/JPY/);
  });

  it("throws an Error for an empty currency string", () => {
    expect(() => convertFromUsd(100, "")).toThrow(Error);
  });

  it("is case-sensitive and rejects lowercase codes", () => {
    expect(() => convertFromUsd(100, "eur")).toThrow(Error);
  });

  it("does not treat inherited object properties as currencies", () => {
    expect(() => convertFromUsd(100, "toString")).toThrow(Error);
    expect(() => convertFromUsd(100, "__proto__")).toThrow(Error);
  });
});

describe("formatMoney", () => {
  it('formats a small USD amount as "$5.00"', () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
  });

  it("formats a large USD amount with a thousands separator", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats millions with multiple thousands separators", () => {
    expect(formatMoney(1234567.891, "USD")).toBe("$1,234,567.89");
  });

  it("formats EUR with the euro symbol", () => {
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50");
  });

  it("formats GBP with the pound symbol", () => {
    expect(formatMoney(5, "GBP")).toBe("£5.00");
  });

  it("matches Intl.NumberFormat en-US currency output", () => {
    for (const currency of ["USD", "EUR", "GBP", "JPY"]) {
      const expected = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(9876.54);
      expect(formatMoney(9876.54, currency)).toBe(expected);
    }
  });

  it("composes with convertFromUsd", () => {
    expect(formatMoney(convertFromUsd(100, "EUR"), "EUR")).toBe("€92.00");
  });
});

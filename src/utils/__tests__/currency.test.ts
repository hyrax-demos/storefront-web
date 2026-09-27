import { describe, it, expect } from "vitest";
import { EXCHANGE_RATES, convertFromUsd, formatMoney } from "../currency";

describe("convertFromUsd", () => {
  it("multiplies by the rate for known currencies", () => {
    expect(convertFromUsd(10, "USD")).toBe(10);
    expect(convertFromUsd(10, "EUR")).toBeCloseTo(9.2);
    expect(convertFromUsd(10, "GBP")).toBeCloseTo(7.9);
  });

  it("keeps the existing rate table", () => {
    expect(EXCHANGE_RATES).toEqual({ USD: 1, EUR: 0.92, GBP: 0.79 });
  });

  it("returns USD amounts unchanged", () => {
    expect(EXCHANGE_RATES.USD).toBe(1);
    for (const amount of [0.01, 1, 19.99, 1234.5]) {
      expect(convertFromUsd(amount, "USD")).toBe(amount);
    }
  });

  const nonUsdCodes = Object.keys(EXCHANGE_RATES).filter(
    (code) => code !== "USD",
  );

  it("has at least two non-USD currencies to exercise", () => {
    expect(nonUsdCodes.length).toBeGreaterThanOrEqual(2);
  });

  it.each(nonUsdCodes)("converts USD to %s as amount * rate", (code) => {
    const rate = EXCHANGE_RATES[code];
    for (const amount of [1, 19.99, 1234.5]) {
      expect(convertFromUsd(amount, code)).toBeCloseTo(amount * rate, 10);
    }
  });

  it.each(Object.keys(EXCHANGE_RATES))("converts 0 USD to 0 %s", (code) => {
    expect(convertFromUsd(0, code)).toBe(0);
  });

  it.each(["XYZ", "", "usd", "toString", "constructor", "__proto__"])(
    "throws for unsupported code %j",
    (code) => {
      expect(() => convertFromUsd(10, code)).toThrow(Error);
      expect(() => convertFromUsd(10, code)).toThrow(JSON.stringify(code));
    },
  );

  it.each(["XYZ", "", "toString", "__proto__"])(
    "never returns NaN for unsupported code %j",
    (code) => {
      let result: number | undefined;
      try {
        result = convertFromUsd(10, code);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      expect(result).toBeUndefined();
      expect(Number.isNaN(result)).toBe(false);
    },
  );
});

describe("formatMoney", () => {
  it("formats with en-US currency conventions", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(9.2, "EUR")).toBe("€9.20");
  });

  it("adds thousands separators and rounds to cents for large USD amounts", () => {
    expect(formatMoney(1234567.891, "USD")).toBe("$1,234,567.89");
  });

  it.each(["EUR", "GBP"])(
    "matches Intl.NumberFormat en-US output for %s",
    (currency) => {
      const intl = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      });
      for (const amount of [0, 5, 9.2, 1234.5, 1234567.891]) {
        expect(formatMoney(amount, currency)).toBe(intl.format(amount));
      }
    },
  );
});

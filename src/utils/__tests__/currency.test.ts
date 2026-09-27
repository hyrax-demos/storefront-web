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

describe("convertFromUsd (rate table coverage)", () => {
  const codes = Object.keys(RATES);

  it("has at least one currency in the rate table", () => {
    expect(codes.length).toBeGreaterThan(0);
  });

  it.each(codes)("converts USD into %s as amount * rate", (code) => {
    const amount = 250;
    expect(convertFromUsd(amount, code)).toBeCloseTo(amount * RATES[code]);
  });

  it.each(codes)("converts a zero amount into %s as 0", (code) => {
    expect(convertFromUsd(0, code)).toBeCloseTo(0);
  });

  it.each(codes)("converts a fractional amount into %s", (code) => {
    const amount = 19.99;
    expect(convertFromUsd(amount, code)).toBeCloseTo(amount * RATES[code]);
  });

  it("returns the same amount for USD", () => {
    expect(RATES).toHaveProperty("USD", 1);
    expect(convertFromUsd(42.5, "USD")).toBe(42.5);
    expect(convertFromUsd(0, "USD")).toBe(0);
  });
});

describe("convertFromUsd (unknown codes)", () => {
  it.each(["XYZ", "", "toString", "constructor", "hasOwnProperty", "__proto__"])(
    "throws an Error for %j",
    (code) => {
      expect(() => convertFromUsd(1, code)).toThrow(Error);
    },
  );

  it("names the bad code in the error message", () => {
    expect(() => convertFromUsd(10, "XYZ")).toThrow(/XYZ/);
  });

  it("never returns NaN for an unknown code", () => {
    for (const code of ["XYZ", "", "toString"]) {
      let result: number | undefined;
      try {
        result = convertFromUsd(1, code);
      } catch {
        // expected
      }
      expect(result).toBeUndefined();
    }
  });

  it("is case-sensitive: lowercase codes are not in the table", () => {
    expect(() => convertFromUsd(1, "usd")).toThrow(Error);
  });
});

describe("formatMoney (edge values)", () => {
  it("formats zero as $0.00", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("formats a small value without separators", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
  });

  it("adds a thousands separator", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("adds multiple separators and rounds to two decimals", () => {
    expect(formatMoney(1234567.891, "USD")).toBe("$1,234,567.89");
  });

  const nonUsd = Object.keys(RATES).filter((code) => code !== "USD");

  it("has at least one non-USD code to check", () => {
    expect(nonUsd.length).toBeGreaterThan(0);
  });

  it.each(nonUsd)("matches en-US Intl currency formatting for %s", (code) => {
    for (const amount of [0, 5, 1234.5, 1234567.891]) {
      const expected = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).format(amount);
      expect(formatMoney(amount, code)).toBe(expected);
    }
  });

  it("formats a converted amount end-to-end", () => {
    const amount = convertFromUsd(1000, "EUR");
    const expected = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(1000 * RATES.EUR);
    expect(formatMoney(amount, "EUR")).toBe(expected);
  });
});

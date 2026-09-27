import { describe, it, expect } from "vitest";
import { RATES, convertFromUsd, formatMoney } from "../currency";

describe("convertFromUsd", () => {
  it("returns the same amount for USD", () => {
    expect(RATES.USD).toBe(1);
    expect(convertFromUsd(42.5, "USD")).toBe(42.5);
  });

  it("multiplies by the table rate for other currencies", () => {
    expect(RATES.EUR).toBe(0.92);
    expect(RATES.GBP).toBe(0.79);
    expect(convertFromUsd(100, "EUR")).toBeCloseTo(92);
    expect(convertFromUsd(19.99, "GBP")).toBeCloseTo(19.99 * 0.79);
  });

  it("converts zero to zero", () => {
    for (const code of Object.keys(RATES)) {
      expect(convertFromUsd(0, code)).toBe(0);
    }
  });

  it.each(["XYZ", "", "toString", "constructor", "usd"])(
    "throws an Error for unsupported code %j",
    (code) => {
      expect(() => convertFromUsd(10, code)).toThrow(Error);
    },
  );
});

describe("formatMoney", () => {
  it("formats USD amounts", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("matches Intl.NumberFormat for non-USD currencies", () => {
    const expected = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(1234.5);
    expect(formatMoney(1234.5, "EUR")).toBe(expected);
  });
});

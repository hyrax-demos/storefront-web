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

  it.each(["XYZ", "", "usd", "toString", "constructor", "__proto__"])(
    "throws for unsupported code %j",
    (code) => {
      expect(() => convertFromUsd(10, code)).toThrow(Error);
      expect(() => convertFromUsd(10, code)).toThrow(JSON.stringify(code));
    },
  );
});

describe("formatMoney", () => {
  it("formats with en-US currency conventions", () => {
    expect(formatMoney(5, "USD")).toBe("$5.00");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(9.2, "EUR")).toBe("€9.20");
  });
});

import { describe, it, expect } from "vitest";
import { formatCents, formatPercent } from "../format";

describe("formatCents", () => {
  it("formats whole dollars and cents", () => {
    expect(formatCents(1234)).toBe("$12.34");
  });

  it("pads single-digit cents", () => {
    expect(formatCents(5)).toBe("$0.05");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatCents(-250)).toBe("-$2.50");
  });

  it("throws TypeError for non-integer input", () => {
    expect(() => formatCents(12.5)).toThrow(TypeError);
    expect(() => formatCents(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatPercent", () => {
  it("formats a quarter", () => {
    expect(formatPercent(0.25)).toBe("25%");
  });

  it("formats a whole ratio", () => {
    expect(formatPercent(1)).toBe("100%");
  });

  it("rounds to the nearest whole percent", () => {
    expect(formatPercent(0.125)).toBe("13%");
  });
});

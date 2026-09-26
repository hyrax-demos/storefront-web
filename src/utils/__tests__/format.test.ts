import { describe, it, expect } from "vitest";
import { formatCents } from "../format";

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

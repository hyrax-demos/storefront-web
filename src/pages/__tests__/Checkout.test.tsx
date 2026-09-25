import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { CartLine } from "../../utils/cart";
import type { PromoRule } from "../../utils/promo";

// Catalog prices (in DOLLARS, as the external catalog API quotes them) keyed
// by product id. Each test sets this before rendering.
let catalogRows: { productId: string; unitPrice: number }[] = [];

vi.mock("../../api/client", () => ({
  authedFetch: vi.fn(async () => ({
    json: async () => catalogRows,
  })),
}));

import { Checkout, dollarsToCents, formatCents } from "../Checkout";

beforeEach(() => {
  catalogRows = [];
});

afterEach(() => {
  cleanup();
});

describe("dollarsToCents", () => {
  it("converts catalog dollar prices to exact integer cents", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1)).toBe(10);
    expect(dollarsToCents(1.1)).toBe(110);
    expect(dollarsToCents(1.10)).toBe(110);
    expect(dollarsToCents(12.5)).toBe(1250);
    expect(dollarsToCents(0)).toBe(0);
  });

  it("always returns an integer despite float representation error", () => {
    for (const d of [0.07, 0.29, 4.35, 19.99, 1.005, 123.45]) {
      expect(Number.isInteger(dollarsToCents(d))).toBe(true);
    }
  });
});

describe("formatCents", () => {
  it("formats integer cents as a dollar display string", () => {
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(50)).toBe("$0.50");
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(100000)).toBe("$1000.00");
  });
});

describe("Checkout", () => {
  const promo: PromoRule = { minSubtotal: 5000, percentOff: 10 };

  it("rounds an exact half-cent discount up once the threshold is met", async () => {
    // Subtotal 5005 cents; 10% = 500.5 cents -> 501 (half up); total 4504.
    const lines: CartLine[] = [
      { productId: "p-1", name: "Widget", unitPriceCents: 1001, quantity: 5 },
    ];
    render(<Checkout lines={lines} promo={promo} />);

    expect(screen.getByText("Total: $45.04")).toBeTruthy();
    expect(screen.getByText("Pay $45.04")).toBeTruthy();
    expect(screen.getByText("Widget × 5 — $10.01")).toBeTruthy();
  });

  it("applies the discount at exactly the threshold", () => {
    // Subtotal 5000 cents meets minSubtotal 5000; 10% = 500; total 4500.
    const lines: CartLine[] = [
      { productId: "p-1", name: "Widget", unitPriceCents: 2500, quantity: 2 },
    ];
    render(<Checkout lines={lines} promo={promo} />);

    expect(screen.getByText("Total: $45.00")).toBeTruthy();
  });

  it("gives no discount one cent below the threshold", () => {
    const lines: CartLine[] = [
      { productId: "p-1", name: "Widget", unitPriceCents: 4999, quantity: 1 },
    ];
    render(<Checkout lines={lines} promo={promo} />);

    expect(screen.getByText("Total: $49.99")).toBeTruthy();
  });

  it("re-prices lines from catalog dollar prices converted to cents", async () => {
    // Catalog quotes 19.99 dollars (19.99 * 100 = 1998.999...) -> 1999 cents.
    // Subtotal 2 * 1999 + 1250 = 5248; 10% = 524.8 -> 525; total 4723.
    catalogRows = [
      { productId: "p-100", unitPrice: 19.99 },
      { productId: "p-205", unitPrice: 12.5 },
    ];
    const lines: CartLine[] = [
      { productId: "p-100", name: "Cotton Tee", unitPriceCents: 1000, quantity: 2 },
      { productId: "p-205", name: "Canvas Tote", unitPriceCents: 1000, quantity: 1 },
    ];
    render(<Checkout lines={lines} promo={promo} />);

    await waitFor(() => {
      expect(screen.getByText("Total: $47.23")).toBeTruthy();
    });
    expect(screen.getByText("Cotton Tee × 2 — $19.99")).toBeTruthy();
    expect(screen.getByText("Canvas Tote × 1 — $12.50")).toBeTruthy();
  });
});

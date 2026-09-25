import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import type { CartLine } from "../../utils/cart";
import type { PromoRule } from "../../utils/promo";

// The catalog price fetch goes through authedFetch; mock it so the catalog
// can quote DOLLAR prices and we can capture the checkout POST.
const authedFetch = vi.fn();
vi.mock("../../api/client", () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}));

import {
  Checkout,
  dollarsToCents,
  formatCents,
  priceCheckout,
} from "../Checkout";

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

function line(
  productId: string,
  unitPriceCents: number,
  quantity = 1,
): CartLine {
  return { productId, name: productId, unitPriceCents, quantity };
}

// $50.00 threshold, 10% off.
const TEN_OFF_OVER_50: PromoRule = { minSubtotal: 5000, percentOff: 10 };

describe("dollarsToCents", () => {
  it("rounds 19.99 to 1999 rather than truncating 1998.9999999999998", () => {
    expect(19.99 * 100).not.toBe(1999);
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  it("converts 0.1 to 10", () => {
    expect(dollarsToCents(0.1)).toBe(10);
  });

  it("converts whole and half dollars exactly", () => {
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(12.5)).toBe(1250);
    expect(dollarsToCents(50)).toBe(5000);
  });

  it("rounds values that land just above a whole cent (0.29, 1.15, 4.35)", () => {
    // 0.29 * 100 = 28.999999999999996, 1.15 * 100 = 114.99999999999999,
    // 4.35 * 100 = 434.99999999999994
    expect(dollarsToCents(0.29)).toBe(29);
    expect(dollarsToCents(1.15)).toBe(115);
    expect(dollarsToCents(4.35)).toBe(435);
  });

  it("follows Math.round for 1.005-style inputs (stored below the half cent)", () => {
    // 1.005 is stored as 1.00499999999999989..., so 1.005 * 100 is
    // 100.49999999999999 and Math.round gives 100.
    expect(dollarsToCents(1.005)).toBe(Math.round(1.005 * 100));
    expect(dollarsToCents(1.005)).toBe(100);
    // 1.015 * 100 is 101.49999999999999 -> 101; 1.025 * 100 is 102.49999999999999 -> 102.
    expect(dollarsToCents(1.015)).toBe(101);
    expect(dollarsToCents(1.025)).toBe(102);
  });

  it("always returns an integer", () => {
    for (let c = 0; c <= 10000; c++) {
      const cents = dollarsToCents(c / 100);
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBe(c);
    }
  });
});

describe("formatCents", () => {
  it("formats cents as a two-decimal dollar string", () => {
    expect(formatCents(1999)).toBe("19.99");
    expect(formatCents(500)).toBe("5.00");
    expect(formatCents(0)).toBe("0.00");
    expect(formatCents(4723)).toBe("47.23");
  });
});

describe("priceCheckout", () => {
  it("re-prices lines from catalog dollar prices into integer cents", () => {
    const result = priceCheckout(
      [line("a", 100, 2), line("b", 100, 1)],
      { a: 19.99, b: 12.5 },
      null,
    );
    expect(result.lines.map((l) => l.unitPriceCents)).toEqual([1999, 1250]);
    expect(result.subtotalCents).toBe(5248);
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(5248);
  });

  it("keeps the cart's own cents price when the catalog has no price", () => {
    const result = priceCheckout([line("a", 1999, 2)], {}, null);
    expect(result.lines[0].unitPriceCents).toBe(1999);
    expect(result.totalCents).toBe(3998);
  });

  it("applies the promo at exactly the threshold", () => {
    // 2 * 19.99 + 10.02 = 3998 + 1002 = 5000 cents
    const result = priceCheckout(
      [line("a", 0, 2), line("b", 0, 1)],
      { a: 19.99, b: 10.02 },
      TEN_OFF_OVER_50,
    );
    expect(result.subtotalCents).toBe(5000);
    expect(result.discountCents).toBe(500);
    expect(result.totalCents).toBe(4500);
  });

  it("gives no discount one cent below the threshold", () => {
    // 2 * 19.99 + 10.01 = 4999 cents
    const result = priceCheckout(
      [line("a", 0, 2), line("b", 0, 1)],
      { a: 19.99, b: 10.01 },
      TEN_OFF_OVER_50,
    );
    expect(result.subtotalCents).toBe(4999);
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(4999);
  });
});

describe("Checkout component", () => {
  beforeEach(() => {
    authedFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  function mockCatalog(prices: Array<{ productId: string; unitPrice: number }>) {
    authedFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/catalog/prices")) return jsonResponse(prices);
      return jsonResponse({});
    });
  }

  it("prices from dollar catalog prices, applies the promo at the threshold and shows the total", async () => {
    mockCatalog([
      { productId: "a", unitPrice: 19.99 },
      { productId: "b", unitPrice: 10.02 },
    ]);
    const lines = [line("a", 100, 2), line("b", 100, 1)];

    render(<Checkout lines={lines} promo={TEN_OFF_OVER_50} />);

    await waitFor(() => expect(screen.getByText("Total: $45.00")).toBeTruthy());
    expect(screen.getByText("Pay $45.00")).toBeTruthy();
    expect(screen.getByText("a × 2 — $19.99")).toBeTruthy();
    expect(screen.getByText("b × 1 — $10.02")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledWith("/catalog/prices?ids=a,b");
  });

  it("sends the cents total as amountCents on submit", async () => {
    mockCatalog([
      { productId: "a", unitPrice: 19.99 },
      { productId: "b", unitPrice: 10.02 },
    ]);
    const lines = [line("a", 100, 2), line("b", 100, 1)];

    render(<Checkout lines={lines} promo={TEN_OFF_OVER_50} />);
    await waitFor(() => expect(screen.getByText("Pay $45.00")).toBeTruthy());

    fireEvent.click(screen.getByText("Pay $45.00"));

    await waitFor(() =>
      expect(authedFetch).toHaveBeenCalledWith("/checkout", expect.anything()),
    );
    const [, init] = authedFetch.mock.calls.find(([p]) => p === "/checkout")!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.amountCents).toBe(4500);
    expect(Number.isInteger(body.amountCents)).toBe(true);
    expect(body.lines).toEqual([
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 1 },
    ]);
  });

  it("renders the cart's cents prices before live prices arrive", () => {
    authedFetch.mockImplementation(() => new Promise(() => {}));
    const lines = [line("a", 1999, 2), line("b", 1250, 1)];

    render(<Checkout lines={lines} promo={null} />);

    expect(screen.getByText("a × 2 — $19.99")).toBeTruthy();
    expect(screen.getByText("b × 1 — $12.50")).toBeTruthy();
    expect(screen.getByText("Total: $52.48")).toBeTruthy();
  });
});

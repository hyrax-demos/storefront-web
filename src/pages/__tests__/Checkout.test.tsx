import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

vi.mock("../../api/client", () => ({
  authedFetch: vi.fn(),
}));

import { authedFetch } from "../../api/client";
import { Checkout } from "../Checkout";
import type { CartLine } from "../../utils/cart";

const mockFetch = vi.mocked(authedFetch);

// Stub the catalog API (which quotes DOLLARS) and the checkout POST.
function stubCatalog(prices: Record<string, number>) {
  mockFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/catalog/prices")) {
      const rows = Object.entries(prices).map(([productId, unitPrice]) => ({
        productId,
        unitPrice,
      }));
      return { json: async () => rows } as Response;
    }
    return { json: async () => ({}) } as Response;
  });
}

function line(productId: string, unitPriceCents: number, quantity: number) {
  return { productId, name: productId, unitPriceCents, quantity } as CartLine;
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Checkout", () => {
  it("displays the cart total from integer-cent line prices", async () => {
    stubCatalog({});
    render(
      <Checkout
        lines={[line("a", 1999, 2), line("b", 1250, 1)]}
        promo={null}
      />,
    );
    expect(screen.getByText("Total: $52.48")).toBeTruthy();
    expect(screen.getByText("Pay $52.48")).toBeTruthy();
    expect(screen.getByText("a × 2 — $19.99")).toBeTruthy();
  });

  it("converts catalog dollar prices to exact cents when repricing", async () => {
    // In float dollars, 0.1 + 0.2 = 0.30000000000000004 and 1.1 * 3 =
    // 3.3000000000000003; in cents the total is exactly 360.
    stubCatalog({ a: 0.1, b: 0.2, c: 1.1 });
    render(
      <Checkout
        lines={[line("a", 1, 1), line("b", 1, 1), line("c", 1, 3)]}
        promo={null}
      />,
    );
    await screen.findByText("Total: $3.60");
    expect(screen.getByText("a × 1 — $0.10")).toBeTruthy();
    expect(screen.getByText("c × 3 — $1.10")).toBeTruthy();
  });

  it("charges the exact cents total where float dollar math would drift", async () => {
    // 19.99 * 3 in float dollars is 59.97000000000000... and 0.29 * 100 is
    // 28.999999999999996; the cents path must be exact.
    stubCatalog({ a: 19.99, b: 0.29 });
    render(
      <Checkout
        lines={[line("a", 0, 3), line("b", 0, 1)]}
        promo={null}
      />,
    );
    await screen.findByText("Total: $60.26");

    fireEvent.submit(screen.getByText("Pay $60.26").closest("form")!);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/checkout", expect.anything()),
    );
    const call = mockFetch.mock.calls.find(([p]) => p === "/checkout")!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body.amountCents).toBe(6026);
    expect(Number.isInteger(body.amountCents)).toBe(true);
  });

  it("applies no discount below the cents promo threshold", async () => {
    stubCatalog({});
    render(
      <Checkout
        lines={[line("a", 4999, 1)]}
        promo={{ minSubtotal: 5000, percentOff: 10 }}
      />,
    );
    expect(screen.getByText("Total: $49.99")).toBeTruthy();
  });

  it("applies the discount at the cents promo threshold", async () => {
    stubCatalog({});
    render(
      <Checkout
        lines={[line("a", 5000, 1)]}
        promo={{ minSubtotal: 5000, percentOff: 10 }}
      />,
    );
    expect(screen.getByText("Total: $45.00")).toBeTruthy();
  });

  it("rounds the promo discount half up and shows it in the total", async () => {
    // 10% of 5005 cents = 500.5 cents -> rounds up to 501; total 4504.
    stubCatalog({});
    render(
      <Checkout
        lines={[line("a", 5005, 1)]}
        promo={{ minSubtotal: 5000, percentOff: 10 }}
      />,
    );
    expect(screen.getByText("Total: $45.04")).toBeTruthy();
  });

  it("applies the promo to repriced catalog lines and charges cents", async () => {
    // Catalog reprices to $25.05 x 2 = 5010 cents; 10% = 501; total 4509.
    stubCatalog({ a: 25.05 });
    render(
      <Checkout
        lines={[line("a", 1000, 2)]}
        promo={{ minSubtotal: 5000, percentOff: 10 }}
      />,
    );
    // Before repricing, 2000 cents is below the threshold: no discount.
    expect(screen.getByText("Total: $20.00")).toBeTruthy();
    await screen.findByText("Total: $45.09");

    fireEvent.submit(screen.getByText("Pay $45.09").closest("form")!);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/checkout", expect.anything()),
    );
    const call = mockFetch.mock.calls.find(([p]) => p === "/checkout")!;
    expect(JSON.parse(call[1]!.body as string).amountCents).toBe(4509);
  });
});

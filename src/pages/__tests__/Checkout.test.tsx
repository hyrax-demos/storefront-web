import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Checkout } from "../Checkout";
import type { CartLine } from "../../utils/cart";
import type { PromoRule } from "../../utils/promo";

// Checkout's internal fetchCatalogPrices goes through authedFetch, so mock the
// API client and serve catalog rows (still quoted in dollars) from a table.
const { authedFetch } = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../../api/client", () => ({ authedFetch }));

let catalog: Array<{ productId: string; unitPrice: number }> = [];

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as unknown as Response;
}

beforeEach(() => {
  catalog = [];
  authedFetch.mockReset();
  authedFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/catalog/prices")) return jsonResponse(catalog);
    return jsonResponse({});
  });
});

afterEach(() => {
  cleanup();
});

function line(
  productId: string,
  name: string,
  unitPriceCents: number,
  quantity: number,
): CartLine {
  return { productId, name, unitPriceCents, quantity };
}

function lineText(): string[] {
  return screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
}

function checkoutBody(): { amountCents: number } {
  const call = authedFetch.mock.calls.find(([path]) => path === "/checkout");
  if (!call) throw new Error("no /checkout request");
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe("Checkout", () => {
  it("renders unit prices and totals as dollar strings", async () => {
    const lines = [
      line("p-100", "Cotton Tee", 1999, 2),
      line("p-205", "Canvas Tote", 1250, 1),
    ];
    const promo: PromoRule = { minSubtotal: 2500, percentOff: 10 };
    render(<Checkout lines={lines} promo={promo} />);
    await waitFor(() => expect(authedFetch).toHaveBeenCalled());

    expect(lineText()).toEqual([
      "Cotton Tee × 2 — $19.99",
      "Canvas Tote × 1 — $12.50",
    ]);
    // 5248 - round_half_up(524.8) = 5248 - 525 = 4723
    expect(screen.getByText("Total: $47.23")).toBeTruthy();
    expect(screen.getByText("Pay $47.23")).toBeTruthy();
  });

  it("converts a catalog dollar price to integer cents when re-pricing", async () => {
    // The cart snapshot is stale ($10.00); the catalog quotes $19.99.
    catalog = [{ productId: "p-100", unitPrice: 19.99 }];
    render(
      <Checkout lines={[line("p-100", "Cotton Tee", 1000, 3)]} promo={null} />,
    );

    await screen.findByText("Total: $59.97");
    expect(lineText()).toEqual(["Cotton Tee × 3 — $19.99"]);
    expect(screen.getByText("Pay $59.97")).toBeTruthy();

    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await waitFor(() => checkoutBody());
    // 1999 cents * 3, exactly — not 5996.999... from float dollars.
    expect(checkoutBody().amountCents).toBe(5997);
  });

  it("keeps the cart price for lines the catalog does not quote", async () => {
    catalog = [{ productId: "p-100", unitPrice: 19.99 }];
    render(
      <Checkout
        lines={[
          line("p-100", "Cotton Tee", 1000, 1),
          line("p-205", "Canvas Tote", 1250, 1),
        ]}
        promo={null}
      />,
    );

    await screen.findByText("Total: $32.49");
    expect(lineText()).toEqual([
      "Cotton Tee × 1 — $19.99",
      "Canvas Tote × 1 — $12.50",
    ]);
  });

  describe("promo cents threshold", () => {
    const promo: PromoRule = { minSubtotal: 5000, percentOff: 10 };

    it("applies the promo at exactly the threshold", async () => {
      render(<Checkout lines={[line("a", "Item", 5000, 1)]} promo={promo} />);
      await waitFor(() => expect(authedFetch).toHaveBeenCalled());

      expect(screen.getByText("Total: $45.00")).toBeTruthy();
      expect(screen.getByText("Pay $45.00")).toBeTruthy();
    });

    it("does not apply the promo one cent below the threshold", async () => {
      render(<Checkout lines={[line("a", "Item", 4999, 1)]} promo={promo} />);
      await waitFor(() => expect(authedFetch).toHaveBeenCalled());

      expect(screen.getByText("Total: $49.99")).toBeTruthy();
      expect(screen.getByText("Pay $49.99")).toBeTruthy();
    });

    it("applies the threshold to the re-priced catalog subtotal", async () => {
      // Cart snapshot is below the threshold, catalog price reaches it.
      catalog = [{ productId: "a", unitPrice: 50 }];
      render(<Checkout lines={[line("a", "Item", 4999, 1)]} promo={promo} />);

      expect(await screen.findByText("Total: $45.00")).toBeTruthy();
    });
  });

  it("rounds a half-cent discount up in the displayed total", async () => {
    // 5% of 1010 cents = 50.5 cents -> 51 cents off -> 959 cents.
    const promo: PromoRule = { minSubtotal: 0, percentOff: 5 };
    render(<Checkout lines={[line("a", "Item", 1010, 1)]} promo={promo} />);
    await waitFor(() => expect(authedFetch).toHaveBeenCalled());

    expect(screen.getByText("Total: $9.59")).toBeTruthy();
    expect(screen.getByText("Pay $9.59")).toBeTruthy();

    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await waitFor(() => checkoutBody());
    expect(checkoutBody().amountCents).toBe(959);
  });
});

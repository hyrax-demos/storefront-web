import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { authedFetch } from "../../api/client";
import { Checkout } from "../Checkout";
import type { CartLine } from "../../utils/cart";

vi.mock("../../api/client", () => ({ authedFetch: vi.fn() }));

const mockedAuthedFetch = vi.mocked(authedFetch);

afterEach(() => {
  mockedAuthedFetch.mockReset();
  cleanup();
});

describe("Checkout catalog price fetch", () => {
  // Uses product ids containing `&`, a space, `#` and `+`, characters that
  // break the query string when an id is sent without percent-encoding.
  it("percent-encodes each product id and keeps the comma separator", async () => {
    mockedAuthedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    const lines: CartLine[] = [
      { productId: "a&b", name: "Mug", unitPrice: 12, quantity: 1 },
      { productId: "c d#e+f", name: "Tee", unitPrice: 20, quantity: 2 },
    ];

    render(<Checkout lines={lines} promo={null} />);

    await waitFor(() => {
      const paths = mockedAuthedFetch.mock.calls.map((call) => call[0]);
      expect(paths).toContain("/catalog/prices?ids=a%26b,c%20d%23e%2Bf");
    });
  });
});

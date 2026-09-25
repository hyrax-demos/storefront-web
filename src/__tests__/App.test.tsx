import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const { authedFetch } = vi.hoisted(() => ({
  // Catalog returns no rows, so the demo cart's own prices are used.
  authedFetch: vi.fn(async () => ({ json: async () => [] }) as unknown),
}));
vi.mock("../api/client", () => ({ authedFetch }));

import { App } from "../App";

afterEach(() => {
  cleanup();
});

describe("App demo checkout", () => {
  it("shows the same demo amounts as the old dollar-based cart", async () => {
    render(<App />);
    await waitFor(() => expect(authedFetch).toHaveBeenCalled());

    const items = screen
      .getAllByRole("listitem")
      .map((el) => el.textContent ?? "");
    expect(items).toContain("Cotton Tee × 2 — $19.99");
    expect(items).toContain("Canvas Tote × 1 — $12.50");
    // $52.48 subtotal clears the $25.00 threshold; 10% off ($5.25) -> $47.23.
    expect(screen.getByText("Total: $47.23")).toBeTruthy();
    expect(screen.getByText("Pay $47.23")).toBeTruthy();
  });
});

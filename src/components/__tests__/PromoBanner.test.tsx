import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PromoBanner, PriceTag } from "../PromoBanner";

afterEach(() => {
  cleanup();
});

// jsdom's real `window.location.assign` cannot be spied on directly (it is a
// non-configurable platform method), so stub the whole `location` object with
// just the bits `claimPromo` touches.
function stubLocation(search: string) {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: { search, assign },
    writable: true,
    configurable: true,
  });
  return assign;
}

describe("PriceTag", () => {
  it("formats the base USD price as a currency string", () => {
    render(<PriceTag basePriceUsd={19.99} />);

    expect(screen.getByText("$19.99")).toBeTruthy();
  });

  it("formats a whole-dollar amount with two decimal places", () => {
    render(<PriceTag basePriceUsd={5} />);

    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  // Keeps basePriceUsd fixed and only switches the currency select, so the
  // shown price can update only if it follows the selected currency.
  it("reformats the price when the selected currency changes", () => {
    render(<PriceTag basePriceUsd={19.99} />);

    expect(screen.getByText("$19.99")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "EUR" },
    });
    expect(screen.getByText("€18.39")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "GBP" },
    });
    expect(screen.getByText("£15.79")).toBeTruthy();
  });
});

describe("PromoBanner claimPromo redirect", () => {
  it("redirects to an allow-listed `next` destination", () => {
    const assign = stubLocation("?next=/orders");

    render(<PromoBanner />);
    fireEvent.click(screen.getByText("Claim offer"));

    expect(assign).toHaveBeenCalledWith("/orders");
  });

  it("falls back to /cart when `next` is missing", () => {
    const assign = stubLocation("");

    render(<PromoBanner />);
    fireEvent.click(screen.getByText("Claim offer"));

    expect(assign).toHaveBeenCalledWith("/cart");
  });

  it("falls back to /cart for a destination that isn't allow-listed", () => {
    const assign = stubLocation("?next=https://evil.example.com");

    render(<PromoBanner />);
    fireEvent.click(screen.getByText("Claim offer"));

    expect(assign).toHaveBeenCalledWith("/cart");
  });
});

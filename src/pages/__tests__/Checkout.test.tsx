import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { Checkout } from "../Checkout";
import type { CartLine } from "../../utils/cart";
import type { PromoRule } from "../../utils/promo";

const { authedFetch } = vi.hoisted(() => ({ authedFetch: vi.fn() }));

vi.mock("../../api/client", () => ({ authedFetch }));

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

beforeEach(() => {
  // The catalog confirms the cart's own prices, so the tests control totals
  // purely through the props below.
  authedFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/catalog/prices")) return jsonResponse([]);
    return jsonResponse({});
  });
});

afterEach(() => {
  cleanup();
  authedFetch.mockReset();
});

async function renderCheckout(lines: CartLine[], promo: PromoRule | null) {
  render(<Checkout lines={lines} promo={promo} />);
  // Let the catalog-price effect settle.
  await act(async () => {});
}

const mug: CartLine = {
  productId: "mug",
  name: "Mug",
  unitPrice: 12.5,
  quantity: 1,
};

function quantity(name: string): string {
  return screen.getByLabelText(`Quantity of ${name}`).textContent ?? "";
}

function increase(name: string) {
  fireEvent.click(screen.getByLabelText(`Increase quantity of ${name}`));
}

function decrease(name: string) {
  fireEvent.click(screen.getByLabelText(`Decrease quantity of ${name}`));
}

describe("Checkout quantity stepper", () => {
  it("does not go below 1", async () => {
    await renderCheckout([mug], null);

    const minus = screen.getByLabelText(
      "Decrease quantity of Mug",
    ) as HTMLButtonElement;
    expect(minus.disabled).toBe(true);
    decrease("Mug");
    expect(quantity("Mug")).toBe("1");

    increase("Mug");
    expect(quantity("Mug")).toBe("2");
    decrease("Mug");
    decrease("Mug");
    expect(quantity("Mug")).toBe("1");
  });

  it("does not go above 99", async () => {
    await renderCheckout([{ ...mug, quantity: 98 }], null);

    increase("Mug");
    expect(quantity("Mug")).toBe("99");
    const plus = screen.getByLabelText(
      "Increase quantity of Mug",
    ) as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
    increase("Mug");
    expect(quantity("Mug")).toBe("99");

    decrease("Mug");
    expect(quantity("Mug")).toBe("98");
  });

  it("recomputes subtotal and total on each change", async () => {
    const pen: CartLine = {
      productId: "pen",
      name: "Pen",
      unitPrice: 0.1,
      quantity: 2,
    };
    await renderCheckout([mug, pen], null);

    expect(screen.getByText("Subtotal: $12.70")).toBeTruthy();
    expect(screen.getByText("Total: $12.70")).toBeTruthy();

    increase("Pen");
    // 12.50 + 3 * 0.10, exact to the cent.
    expect(screen.getByText("Subtotal: $12.80")).toBeTruthy();
    expect(screen.getByText("Total: $12.80")).toBeTruthy();

    increase("Mug");
    expect(screen.getByText("Subtotal: $25.30")).toBeTruthy();
    expect(screen.getByText("Total: $25.30")).toBeTruthy();
    expect(screen.getByText("Pay $25.30")).toBeTruthy();
  });

  it("charges the adjusted quantities and total", async () => {
    await renderCheckout([mug], null);

    increase("Mug");
    await act(async () => {
      fireEvent.submit(screen.getByText("Pay $25.00").closest("form")!);
    });

    const call = authedFetch.mock.calls.find(([path]) => path === "/checkout");
    expect(call).toBeTruthy();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.lines).toEqual([{ productId: "mug", quantity: 2 }]);
    expect(body.amountCents).toBe(2500);
  });
});

describe("Checkout promo discount line", () => {
  const promo: PromoRule = { minSubtotal: 25, percentOff: 10 };

  it("is hidden when there is no promo", async () => {
    await renderCheckout([mug], null);

    expect(screen.queryByText(/^Discount:/)).toBeNull();
  });

  it("is hidden while the promo returns no discount", async () => {
    await renderCheckout([mug], promo);

    expect(screen.queryByText(/^Discount:/)).toBeNull();
    expect(screen.getByText("Total: $12.50")).toBeTruthy();
  });

  it("appears once a quantity change clears the threshold", async () => {
    await renderCheckout([mug], promo);

    increase("Mug");
    expect(screen.getByText("Subtotal: $25.00")).toBeTruthy();
    expect(screen.getByText("Discount: -$2.50")).toBeTruthy();
    expect(screen.getByText("Total: $22.50")).toBeTruthy();

    decrease("Mug");
    expect(screen.queryByText(/^Discount:/)).toBeNull();
    expect(screen.getByText("Total: $12.50")).toBeTruthy();
  });
});

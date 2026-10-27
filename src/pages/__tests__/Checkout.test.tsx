import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { Checkout } from "../Checkout";
import type { CartLine } from "../../utils/cart";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MUG: CartLine = {
  productId: "p-1",
  name: "Cheap Mug",
  unitPrice: 5,
  quantity: 1,
};
const LAMP: CartLine = {
  productId: "p-2",
  name: "Mid Lamp",
  unitPrice: 35,
  quantity: 1,
};

type PriceRow = { productId: string; unitPrice: number };
type FetchResponse = { status: number; json: () => Promise<unknown> };

// Stubs the global fetch that authedFetch calls. Catalog price requests stay
// pending until the test resolves them by URL, which lets a test choose the
// order responses arrive in. The checkout POST resolves at once.
function stubFetch() {
  const pending = new Map<string, (res: FetchResponse) => void>();
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.startsWith("/api/catalog/prices")) {
      return new Promise<FetchResponse>((resolve) => {
        pending.set(url, resolve);
      });
    }
    return Promise.resolve<FetchResponse>({
      status: 200,
      json: async () => ({}),
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  async function respond(url: string, rows: PriceRow[]) {
    const resolve = pending.get(url);
    if (!resolve) throw new Error(`no pending request for ${url}`);
    await act(async () => {
      resolve({ status: 200, json: async () => rows });
      // Let the fetch -> json -> .then chain finish inside this act scope.
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
  }

  return { fetchMock, respond };
}

function shownLines(): (string | null)[] {
  return screen.queryAllByRole("listitem").map((li) => li.textContent);
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function postedAmountCents(
  fetchMock: ReturnType<typeof stubFetch>["fetchMock"],
): unknown {
  const call = fetchMock.mock.calls.find(([url]) => url === "/api/checkout");
  if (!call || !call[1]) throw new Error("no checkout request");
  return JSON.parse(call[1].body as string).amountCents;
}

describe("Checkout", () => {
  it("keeps the newer lines' prices when the older response lands last", async () => {
    // Input: lines [Cheap Mug], then lines [Cheap Mug, Mid Lamp] before the
    // first price request resolves, with the second request's prices
    // arriving before the first request's.
    const { fetchMock, respond } = stubFetch();
    const { rerender } = render(<Checkout lines={[MUG]} promo={null} />);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog/prices?ids=p-1",
      expect.anything(),
    );

    rerender(<Checkout lines={[MUG, LAMP]} promo={null} />);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog/prices?ids=p-1,p-2",
      expect.anything(),
    );

    await respond("/api/catalog/prices?ids=p-1,p-2", [
      { productId: "p-1", unitPrice: 6 },
      { productId: "p-2", unitPrice: 40 },
    ]);
    await respond("/api/catalog/prices?ids=p-1", [
      { productId: "p-1", unitPrice: 9 },
    ]);

    expect(shownLines()).toEqual([
      "Cheap Mug × 1 — $6.00",
      "Mid Lamp × 1 — $40.00",
    ]);
    expect(screen.getByText("Total: $46.00")).toBeTruthy();

    await submit();
    expect(postedAmountCents(fetchMock)).toBe(4600);
  });

  it("charges the fetched prices when responses arrive in order", async () => {
    // Input: the same two lines values, with each price request resolving
    // before the next lines value is rendered.
    const { fetchMock, respond } = stubFetch();
    const { rerender } = render(<Checkout lines={[MUG]} promo={null} />);
    await respond("/api/catalog/prices?ids=p-1", [
      { productId: "p-1", unitPrice: 9 },
    ]);
    expect(shownLines()).toEqual(["Cheap Mug × 1 — $9.00"]);

    rerender(<Checkout lines={[MUG, LAMP]} promo={null} />);
    await respond("/api/catalog/prices?ids=p-1,p-2", [
      { productId: "p-1", unitPrice: 6 },
      { productId: "p-2", unitPrice: 40 },
    ]);

    expect(shownLines()).toEqual([
      "Cheap Mug × 1 — $6.00",
      "Mid Lamp × 1 — $40.00",
    ]);

    await submit();
    expect(postedAmountCents(fetchMock)).toBe(4600);
  });
});

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

type PendingRequest = {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
};

let pending: PendingRequest[] = [];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

// A fetch mock whose responses are resolved manually by the test, so the
// test controls the order in which responses "arrive". It deliberately
// ignores the abort signal so we also exercise the "response arrives anyway"
// path (e.g. a fetch implementation or proxy that doesn't honour abort).
function installFetchMock() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolveResponse) => {
      pending.push({
        url,
        signal: init?.signal ?? undefined,
        resolve: (hits) =>
          resolveResponse({
            json: async () => ({ hits }),
          } as Response),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    const fetchMock = installFetchMock();
    render(<SearchBox />);

    typeQuery("m");
    typeQuery("mu");
    typeQuery("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    pending[0].resolve([hit("Mug")]);
    await flush();
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("la");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    typeQuery("lamp");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=la",
      "/api/search?q=lamp",
    ]);
    const [older, newer] = pending;

    // Superseded request is cancelled.
    expect(older.signal?.aborted).toBe(true);
    expect(newer.signal?.aborted).toBe(false);

    // Network reorders: newer resolves first, then the stale older one.
    newer.resolve([hit("Desk Lamp")]);
    await flush();
    expect(titles()).toEqual(["Desk Lamp"]);

    older.resolve([hit("Lava Rock")]);
    await flush();
    expect(titles()).toEqual(["Desk Lamp"]);
  });

  it("ignores a stale response that arrives while the newer one is still in flight", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("ch");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    typeQuery("chair");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const [older, newer] = pending;

    older.resolve([hit("Cheese")]);
    await flush();
    expect(titles()).toEqual([]);

    newer.resolve([hit("Chair")]);
    await flush();
    expect(titles()).toEqual(["Chair"]);
  });

  it("does not repopulate results after the query is cleared", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    typeQuery("");
    expect(pending[0].signal?.aborted).toBe(true);

    pending[0].resolve([hit("Mug")]);
    await flush();
    expect(titles()).toEqual([]);
  });

  it("aborts the in-flight request on unmount", () => {
    installFetchMock();
    const { unmount } = render(<SearchBox />);

    typeQuery("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    unmount();
    expect(pending[0].signal?.aborted).toBe(true);
  });
});

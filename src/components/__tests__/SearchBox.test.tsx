import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

interface PendingRequest {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
}

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

let pending: PendingRequest[];

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  // A fetch whose responses are resolved manually by the test, in any order.
  // It deliberately ignores the abort signal so we also cover a response that
  // arrives even though its request was cancelled.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          pending.push({
            url,
            signal: init?.signal ?? undefined,
            resolve: (hits) =>
              resolve({ json: async () => ({ hits }) } as Response),
          });
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

async function flush() {
  // Let the resolved fetch/json promise chain and the React update settle.
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    render(<SearchBox />);

    type("s");
    type("sh");
    type("sho");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=sho");

    pending[0].resolve([hit("Shoe")]);
    await flush();

    expect(screen.getByText("Shoe")).toBeTruthy();
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    type("sh");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("shoe");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=sh",
      "/api/search?q=shoe",
    ]);

    // Newer response arrives first...
    pending[1].resolve([hit("Running shoe")]);
    await flush();
    expect(screen.getByText("Running shoe")).toBeTruthy();

    // ...then the stale one arrives late and must not replace it.
    pending[0].resolve([hit("Shirt")]);
    await flush();

    expect(screen.getByText("Running shoe")).toBeTruthy();
    expect(screen.queryByText("Shirt")).toBeNull();
  });

  it("ignores a superseded response even if it arrives before the newer one", async () => {
    render(<SearchBox />);

    type("sh");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("shoe");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    pending[0].resolve([hit("Shirt")]);
    await flush();
    expect(screen.queryByText("Shirt")).toBeNull();

    pending[1].resolve([hit("Running shoe")]);
    await flush();
    expect(screen.getByText("Running shoe")).toBeTruthy();
  });

  it("aborts the in-flight request when the query changes", () => {
    render(<SearchBox />);

    type("sh");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending[0].signal?.aborted).toBe(false);

    type("shoe");

    expect(pending[0].signal?.aborted).toBe(true);
  });

  it("does not apply a pending response after the query is cleared", async () => {
    render(<SearchBox />);

    type("sh");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("");

    pending[0].resolve([hit("Shirt")]);
    await flush();

    expect(screen.queryByText("Shirt")).toBeNull();
  });
});

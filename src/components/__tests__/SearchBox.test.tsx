import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

const DEBOUNCE_MS = 250;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

interface PendingRequest {
  query: string;
  signal: AbortSignal;
  resolve: (hits: SearchHit[]) => void;
}

function stubFetchQueue(): { pending: PendingRequest[] } {
  const pending: PendingRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const query = new URL(url, "http://localhost").searchParams.get("q") ?? "";
      return new Promise((resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }
        pending.push({
          query,
          signal,
          resolve: (hits) =>
            resolve({ json: async () => ({ hits }) } as Response),
        });
      });
    }),
  );
  return { pending };
}

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause in typing", async () => {
    vi.useFakeTimers();
    const { pending } = stubFetchQueue();
    render(<SearchBox />);

    const input = screen.getByPlaceholderText("Search products");
    fireEvent.change(input, { target: { value: "l" } });
    fireEvent.change(input, { target: { value: "la" } });
    fireEvent.change(input, { target: { value: "lam" } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(pending).toHaveLength(1);
    expect(pending[0].query).toBe("lam");
  });

  it("applies the latest response even if an older request resolves after it", async () => {
    vi.useFakeTimers();
    const { pending } = stubFetchQueue();
    render(<SearchBox />);

    const input = screen.getByPlaceholderText("Search products");

    fireEvent.change(input, { target: { value: "lamp" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    fireEvent.change(input, { target: { value: "mug" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(pending).toHaveLength(2);
    const [older, newer] = pending;

    // Newer request's response arrives first...
    await act(async () => {
      newer.resolve([hit("Mug")]);
    });
    expect(screen.getByText("Mug")).toBeTruthy();

    // ...then the older, slower request finally resolves. It must not
    // overwrite what's currently displayed.
    await act(async () => {
      older.resolve([hit("Lamp")]);
    });

    expect(screen.queryByText("Lamp")).toBeNull();
    expect(screen.getByText("Mug")).toBeTruthy();
  });

  it("aborts the in-flight request for a query that is no longer current", async () => {
    vi.useFakeTimers();
    const { pending } = stubFetchQueue();
    render(<SearchBox />);

    const input = screen.getByPlaceholderText("Search products");

    fireEvent.change(input, { target: { value: "lamp" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(pending).toHaveLength(1);
    const older = pending[0];
    expect(older.signal.aborted).toBe(false);

    fireEvent.change(input, { target: { value: "mug" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(older.signal.aborted).toBe(true);
  });

  it("clears results when the query is emptied", async () => {
    vi.useFakeTimers();
    const { pending } = stubFetchQueue();
    render(<SearchBox />);

    const input = screen.getByPlaceholderText("Search products");
    fireEvent.change(input, { target: { value: "lamp" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {
      pending[0].resolve([hit("Lamp")]);
    });
    expect(screen.getByText("Lamp")).toBeTruthy();

    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.queryByText("Lamp")).toBeNull();
  });
});

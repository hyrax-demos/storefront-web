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

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

// Per-query response latency (ms) and payload. The older query ("m") is
// deliberately much slower than the newer one ("mu") so its response lands
// last.
const RESPONSES: Record<string, { delay: number; hits: SearchHit[] }> = {
  m: { delay: 1000, hits: [hit("Stale Monitor")] },
  mu: { delay: 100, hits: [hit("Fresh Mug")] },
};

let signals: Record<string, AbortSignal | undefined>;

beforeEach(() => {
  vi.useFakeTimers();
  signals = {};
  // This mock deliberately ignores the abort signal and always resolves, so
  // the test covers the component's own guard, not just fetch cancellation.
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const q = new URL(url, "http://localhost").searchParams.get("q") ?? "";
      signals[q] = init?.signal ?? undefined;
      const { delay, hits } = RESPONSES[q];
      return new Promise<Response>((resolve) => {
        setTimeout(
          () => resolve({ json: async () => ({ hits }) } as Response),
          delay,
        );
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

describe("SearchBox", () => {
  it("ignores a response for an older query that resolves after a newer one", async () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText("Search products");

    // First query: debounce elapses and the slow request starts.
    fireEvent.change(input, { target: { value: "m" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second query: debounce elapses and the fast request starts.
    fireEvent.change(input, { target: { value: "mu" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    // The newer, faster response arrives first.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(titles()).toEqual(["Fresh Mug"]);

    // The older, slower response arrives afterwards and must be discarded.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(titles()).toEqual(["Fresh Mug"]);

    // The superseded request was cancelled; the current one was not.
    expect(signals.m?.aborted).toBe(true);
    expect(signals.mu?.aborted).toBe(false);
  });
});

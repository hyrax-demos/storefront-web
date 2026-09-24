import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

interface PendingRequest {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
}

let pending: PendingRequest[] = [];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

// A fetch stub whose responses are resolved manually by the test, in any
// order. It deliberately ignores the abort signal so we also verify that a
// late-arriving stale response is dropped even if the network doesn't cancel.
function installFetch() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve) => {
      pending.push({
        url,
        signal: init?.signal ?? undefined,
        resolve: (hits) =>
          resolve({ json: async () => ({ hits }) } as unknown as Response),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function type(value: string) {
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

beforeEach(() => {
  pending = [];
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    const fetchMock = installFetch();
    render(<SearchBox />);

    type("m");
    type("mu");
    type("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    pending[0].resolve([hit("Mug")]);
    await flush();
    expect(screen.getByText("Mug")).toBeTruthy();
  });

  it("ignores an older response that resolves after a newer one", async () => {
    installFetch();
    render(<SearchBox />);

    type("lamp");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("lamps");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=lamp",
      "/api/search?q=lamps",
    ]);

    // Newer resolves first...
    pending[1].resolve([hit("Fresh Lamps")]);
    await flush();
    expect(screen.getByText("Fresh Lamps")).toBeTruthy();

    // ...then the stale one arrives late and must not overwrite it.
    pending[0].resolve([hit("Stale Lamp")]);
    await flush();
    expect(screen.getByText("Fresh Lamps")).toBeTruthy();
    expect(screen.queryByText("Stale Lamp")).toBeNull();
  });

  it("aborts the superseded request when a newer query is issued", () => {
    installFetch();
    render(<SearchBox />);

    type("chair");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("chairs");

    expect(pending[0].signal?.aborted).toBe(true);
  });

  it("does not apply a stale response after the query is cleared", async () => {
    installFetch();
    render(<SearchBox />);

    type("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("");

    pending[0].resolve([hit("Stale Mug")]);
    await flush();
    expect(screen.queryByText("Stale Mug")).toBeNull();
  });
});

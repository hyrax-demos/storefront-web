import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

type Pending = {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
};

let pending: Pending[] = [];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      return new Promise<Response>((resolve) => {
        pending.push({
          url,
          signal: init?.signal ?? undefined,
          resolve: (hits) =>
            resolve({ json: async () => ({ hits }) } as unknown as Response),
        });
      });
    }),
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

async function flushDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

async function respond(p: Pending, hits: SearchHit[]) {
  await act(async () => {
    p.resolve(hits);
    await Promise.resolve();
  });
  // Let the .json() and .then() chains settle.
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    render(<SearchBox />);

    type("m");
    type("mu");
    type("mug");
    expect(pending).toHaveLength(0);

    await flushDebounce();
    expect(pending).toHaveLength(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    type("lamp");
    await flushDebounce();
    type("lampshade");
    await flushDebounce();
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=lamp",
      "/api/search?q=lampshade",
    ]);

    // Newer resolves first, then the older one arrives late.
    await respond(pending[1], [hit("Lampshade")]);
    expect(titles()).toEqual(["Lampshade"]);

    await respond(pending[0], [hit("Lamp"), hit("Desk Lamp")]);
    expect(titles()).toEqual(["Lampshade"]);
  });

  it("aborts the superseded request when a newer query is issued", async () => {
    render(<SearchBox />);

    type("chair");
    await flushDebounce();
    const first = pending[0];
    expect(first.signal?.aborted).toBe(false);

    type("chairs");
    expect(first.signal?.aborted).toBe(true);

    await flushDebounce();
    expect(pending[1].signal?.aborted).toBe(false);
  });

  it("does not repopulate results from a request pending when the input is cleared", async () => {
    render(<SearchBox />);

    type("mug");
    await flushDebounce();
    type("");

    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

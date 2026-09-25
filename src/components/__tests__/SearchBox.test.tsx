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

type Pending = {
  url: string;
  signal?: AbortSignal;
  resolve: (hits: SearchHit[]) => void;
};

let pending: Pending[];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      return new Promise((resolve) => {
        pending.push({
          url,
          signal: init?.signal ?? undefined,
          resolve: (hits) => resolve({ json: async () => ({ hits }) }),
        });
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

async function flush() {
  // Let resolved fetch/json promises settle and React commit.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request", async () => {
    render(<SearchBox />);
    type("m");
    type("mu");
    type("mug");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    pending[0].resolve([hit("Mug")]);
    await flush();
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    type("la");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("lamp");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=la",
      "/api/search?q=lamp",
    ]);

    // Older request is cancelled once superseded.
    expect(pending[0].signal?.aborted).toBe(true);
    expect(pending[1].signal?.aborted).toBe(false);

    // Newer resolves first, then the stale one arrives late.
    pending[1].resolve([hit("Lamp")]);
    await flush();
    expect(titles()).toEqual(["Lamp"]);

    pending[0].resolve([hit("Ladder"), hit("Latte")]);
    await flush();
    expect(titles()).toEqual(["Lamp"]);
  });

  it("does not repopulate results after the input is cleared", async () => {
    render(<SearchBox />);
    type("chair");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    type("");
    pending[0].resolve([hit("Chair")]);
    await flush();
    expect(titles()).toEqual([]);
  });
});

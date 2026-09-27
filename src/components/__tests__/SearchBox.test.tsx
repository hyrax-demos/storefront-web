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
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
};

let pending: Pending[];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  // Deliberately ignore the abort signal when resolving so we also cover
  // servers/polyfills that deliver a response after the request was cancelled.
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      return new Promise((resolve) => {
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

async function respond(index: number, hits: SearchHit[]) {
  await act(async () => {
    pending[index].resolve(hits);
    await Promise.resolve();
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
    expect(fetch).not.toHaveBeenCalled();
    await flushDebounce();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    await respond(0, [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    type("mu");
    await flushDebounce();
    type("mug");
    await flushDebounce();
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=mu",
      "/api/search?q=mug",
    ]);

    // Network reorders: newest resolves first, oldest arrives late.
    await respond(1, [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);

    await respond(0, [hit("Muffin"), hit("Mustard")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores a superseded response that resolves before the latest one", async () => {
    render(<SearchBox />);

    type("mu");
    await flushDebounce();
    type("mug");
    await flushDebounce();

    await respond(0, [hit("Muffin")]);
    expect(titles()).toEqual([]);

    await respond(1, [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("aborts the in-flight request when the query changes", async () => {
    render(<SearchBox />);

    type("mu");
    await flushDebounce();
    expect(pending[0].signal?.aborted).toBe(false);

    type("mug");
    expect(pending[0].signal?.aborted).toBe(true);
  });

  it("does not repopulate results after the input is cleared", async () => {
    render(<SearchBox />);

    type("mug");
    await flushDebounce();
    type("");

    await respond(0, [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

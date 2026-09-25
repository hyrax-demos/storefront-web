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

async function flushDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

async function respond(p: Pending, hits: SearchHit[]) {
  await act(async () => {
    p.resolve(hits);
  });
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request and renders its results", async () => {
    render(<SearchBox />);
    type("m");
    type("mu");
    type("mug");
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
    type("lamps");
    await flushDebounce();
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=lamp",
      "/api/search?q=lamps",
    ]);

    const [older, newer] = pending;
    await respond(newer, [hit("Lamps result")]);
    expect(titles()).toEqual(["Lamps result"]);

    await respond(older, [hit("Stale lamp result")]);
    expect(titles()).toEqual(["Lamps result"]);
  });

  it("never applies a superseded response even if it arrives first", async () => {
    render(<SearchBox />);
    type("chair");
    await flushDebounce();
    type("chairs");
    await flushDebounce();

    const [older, newer] = pending;
    await respond(older, [hit("Stale chair")]);
    expect(titles()).toEqual([]);

    await respond(newer, [hit("Chairs")]);
    expect(titles()).toEqual(["Chairs"]);
  });

  it("aborts the superseded request", async () => {
    render(<SearchBox />);
    type("desk");
    await flushDebounce();
    type("desks");
    await flushDebounce();

    expect(pending[0].signal?.aborted).toBe(true);
    expect(pending[1].signal?.aborted).toBe(false);
  });

  it("does not repopulate results after the query is cleared", async () => {
    render(<SearchBox />);
    type("mug");
    await flushDebounce();
    type("");

    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

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
      return new Promise<Response>((resolveRes, rejectRes) => {
        const signal = init?.signal ?? undefined;
        signal?.addEventListener("abort", () => {
          rejectRes(new DOMException("Aborted", "AbortError"));
        });
        pending.push({
          url,
          signal,
          resolve: (hits) =>
            resolveRes({ json: async () => ({ hits }) } as Response),
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
    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    await act(async () => {
      pending[0].resolve([hit("Mug")]);
    });
    await flush();
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    type("la");
    await flush();
    type("lamp");
    await flush();
    expect(pending).toHaveLength(2);

    const [older, newer] = pending;
    expect(older.signal?.aborted).toBe(true);
    expect(newer.signal?.aborted).toBe(false);

    await act(async () => {
      newer.resolve([hit("Lamp")]);
    });
    await flush();
    expect(titles()).toEqual(["Lamp"]);

    // The stale response arrives late — it must not replace the newer results.
    await act(async () => {
      older.resolve([hit("Ladder")]);
    });
    await flush();
    expect(titles()).toEqual(["Lamp"]);
  });

  it("does not apply an in-flight response after the query is cleared", async () => {
    render(<SearchBox />);

    type("chair");
    await flush();
    expect(pending).toHaveLength(1);

    type("");
    await flush();

    await act(async () => {
      pending[0].resolve([hit("Chair")]);
    });
    await flush();
    expect(titles()).toEqual([]);
  });
});

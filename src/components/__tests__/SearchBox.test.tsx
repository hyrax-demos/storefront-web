import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
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

function queryOf(p: Pending): string {
  return new URL(p.url, "http://localhost").searchParams.get("q") ?? "";
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      return new Promise<Response>((resolveFetch) => {
        pending.push({
          url,
          signal: init?.signal ?? undefined,
          resolve: (hits) =>
            resolveFetch({
              json: async () => ({ hits }),
            } as unknown as Response),
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

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    render(<SearchBox />);
    type("m");
    type("mu");
    type("mug");
    expect(pending).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending).toHaveLength(1);
    expect(queryOf(pending[0])).toBe("mug");

    pending[0].resolve([hit("Cheap Mug")]);
    await flush();
    expect(titles()).toEqual(["Cheap Mug"]);
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
    expect(pending.map(queryOf)).toEqual(["la", "lamp"]);
    const [older, newer] = pending;

    // The older request is cancelled once it is superseded.
    expect(older.signal?.aborted).toBe(true);
    expect(newer.signal?.aborted).toBe(false);

    // Network reorders: newer resolves first, then older.
    newer.resolve([hit("Mid Lamp")]);
    await flush();
    expect(titles()).toEqual(["Mid Lamp"]);

    older.resolve([hit("Lava Rock"), hit("Ladder")]);
    await flush();
    expect(titles()).toEqual(["Mid Lamp"]);
  });

  it("does not apply an in-flight response after the query is cleared", async () => {
    render(<SearchBox />);

    type("chair");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(pending).toHaveLength(1);

    type("");
    pending[0].resolve([hit("Pricey Chair")]);
    await flush();
    expect(titles()).toEqual([]);
  });
});

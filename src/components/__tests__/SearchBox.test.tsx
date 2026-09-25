import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
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

function queryOf(req: PendingRequest): string {
  return new URL(req.url, "http://localhost").searchParams.get("q") ?? "";
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

async function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

async function respond(req: PendingRequest, hits: SearchHit[]) {
  await act(async () => {
    req.resolve(hits);
    // Let the fetch -> json -> setHits promise chain settle.
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

describe("SearchBox", () => {
  it("debounces keystrokes into one request per pause", async () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText("Search products");

    fireEvent.change(input, { target: { value: "m" } });
    fireEvent.change(input, { target: { value: "mu" } });
    fireEvent.change(input, { target: { value: "mug" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(pending).toHaveLength(1);
    expect(queryOf(pending[0])).toBe("mug");

    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);

    await type("la");
    await type("lamp");
    expect(pending.map(queryOf)).toEqual(["la", "lamp"]);

    const [older, newer] = pending;
    expect(older.signal?.aborted).toBe(true);
    expect(newer.signal?.aborted).toBe(false);

    await respond(newer, [hit("Lamp")]);
    expect(titles()).toEqual(["Lamp"]);

    // The stale response arrives late and must not replace the newer results.
    await respond(older, [hit("Lava"), hit("Latte")]);
    expect(titles()).toEqual(["Lamp"]);
  });

  it("ignores an older response that resolves before the newer one", async () => {
    render(<SearchBox />);

    await type("la");
    await type("lamp");
    const [older, newer] = pending;

    await respond(older, [hit("Lava")]);
    expect(titles()).toEqual([]);

    await respond(newer, [hit("Lamp")]);
    expect(titles()).toEqual(["Lamp"]);
  });

  it("does not repopulate results from an in-flight request after the box is cleared", async () => {
    render(<SearchBox />);

    await type("mug");
    fireEvent.change(screen.getByPlaceholderText("Search products"), {
      target: { value: "" },
    });

    expect(pending[0].signal?.aborted).toBe(true);
    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

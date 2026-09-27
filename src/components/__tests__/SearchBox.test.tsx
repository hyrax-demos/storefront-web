import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

type Pending = { url: string; resolve: (hits: SearchHit[]) => void };
let pending: Pending[] = [];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      new Promise((resolve) => {
        pending.push({
          url,
          resolve: (hits) => resolve({ json: async () => ({ hits }) }),
        });
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

describe("SearchBox", () => {
  it("debounces keystrokes into a single request", async () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText("Search products");
    fireEvent.change(input, { target: { value: "m" } });
    fireEvent.change(input, { target: { value: "mu" } });
    await type("mug");
    expect(pending).toHaveLength(1);
    expect(pending[0].url).toBe("/api/search?q=mug");
  });

  it("ignores an older response that resolves after a newer one", async () => {
    render(<SearchBox />);
    await type("la");
    await type("lamp");
    expect(pending).toHaveLength(2);

    await act(async () => {
      pending[1].resolve([hit("Newer Lamp")]);
    });
    await act(async () => {
      pending[0].resolve([hit("Stale La")]);
    });

    expect(screen.getByText("Newer Lamp")).toBeTruthy();
    expect(screen.queryByText("Stale La")).toBeNull();
  });

  it("aborts the superseded request", async () => {
    render(<SearchBox />);
    await type("la");
    await type("lamp");
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect((calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    expect((calls[1][1] as RequestInit).signal?.aborted).toBe(false);
  });

  it("does not show a stale response after the query is cleared", async () => {
    render(<SearchBox />);
    await type("mug");
    await type("");
    await act(async () => {
      pending[0].resolve([hit("Old Mug")]);
    });
    expect(screen.queryByText("Old Mug")).toBeNull();
  });
});

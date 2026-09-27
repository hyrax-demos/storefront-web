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

interface PendingRequest {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (hits: SearchHit[]) => void;
}

let pending: PendingRequest[];

// A fetch mock whose responses are resolved manually by the test, so we can
// deliver them in any order. It deliberately ignores the abort signal so that
// the component's own staleness handling is exercised, not just cancellation.
function installFetchMock() {
  pending = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((resolveResponse) => {
      pending.push({
        url: String(input),
        signal: init?.signal ?? undefined,
        resolve: (hits) =>
          resolveResponse({
            json: async () => ({ hits }),
          } as Response),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function respond(index: number, hits: SearchHit[]) {
  await act(async () => {
    pending[index].resolve(hits);
  });
}

function titles(): string[] {
  return screen.queryAllByRole("link").map((el) => el.textContent ?? "");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("debounces keystrokes into a single request per pause", async () => {
    const fetchMock = installFetchMock();
    render(<SearchBox />);

    typeQuery("m");
    await advance(100);
    typeQuery("mu");
    await advance(100);
    typeQuery("mug");
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");

    await respond(0, [hit("Mug")]);
    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("lamp");
    await advance(250);
    typeQuery("lamp shade");
    await advance(250);
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=lamp",
      "/api/search?q=lamp%20shade",
    ]);

    // Newer request resolves first...
    await respond(1, [hit("Lamp Shade")]);
    expect(titles()).toEqual(["Lamp Shade"]);

    // ...then the stale one arrives late and must not overwrite it.
    await respond(0, [hit("Desk Lamp"), hit("Floor Lamp")]);
    expect(titles()).toEqual(["Lamp Shade"]);
  });

  it("ignores an older response even if it resolves before the newer one", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("chair");
    await advance(250);
    typeQuery("chairs");
    await advance(250);

    await respond(0, [hit("Old Chair")]);
    expect(titles()).toEqual([]);

    await respond(1, [hit("Chair A"), hit("Chair B")]);
    expect(titles()).toEqual(["Chair A", "Chair B"]);
  });

  it("aborts the superseded request when the query changes", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("mug");
    await advance(250);
    expect(pending[0].signal?.aborted).toBe(false);

    typeQuery("mugs");
    expect(pending[0].signal?.aborted).toBe(true);

    await advance(250);
    expect(pending[1].signal?.aborted).toBe(false);
  });

  it("does not repopulate results after the input is cleared", async () => {
    installFetchMock();
    render(<SearchBox />);

    typeQuery("mug");
    await advance(250);
    typeQuery("");

    await respond(0, [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

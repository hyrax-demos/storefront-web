import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

const DEBOUNCE_MS = 250;

interface PendingRequest {
  url: string;
  signal: AbortSignal | undefined;
  respond: (hits: SearchHit[]) => void;
}

let pending: PendingRequest[];
let fetchMock: ReturnType<typeof vi.fn>;

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

// A fetch stub whose responses are resolved manually by the test, so the test
// controls the order in which the "network" delivers them. It deliberately
// ignores the abort signal unless `honourAbort` is set, to model a response
// that still arrives after the request has been superseded.
function installFetch({ honourAbort = false } = {}) {
  pending = [];
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? undefined;
      if (honourAbort && signal) {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }
      pending.push({
        url,
        signal,
        respond: (hits) =>
          resolve({ json: async () => ({ hits }) } as unknown as Response),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
}

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

function waitDebounce() {
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

async function respond(req: PendingRequest, hits: SearchHit[]) {
  await act(async () => {
    req.respond(hits);
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
  it("issues a single request per pause in typing", () => {
    installFetch();
    render(<SearchBox />);

    type("m");
    type("mu");
    type("mug");
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pending[0].url).toBe("/api/search?q=mug");
  });

  it("renders results for the latest query", async () => {
    installFetch();
    render(<SearchBox />);

    type("mug");
    waitDebounce();
    await respond(pending[0], [hit("Mug")]);

    expect(titles()).toEqual(["Mug"]);
  });

  it("ignores an older response that resolves after a newer one", async () => {
    installFetch();
    render(<SearchBox />);

    type("la");
    waitDebounce();
    type("lamp");
    waitDebounce();
    expect(pending.map((p) => p.url)).toEqual([
      "/api/search?q=la",
      "/api/search?q=lamp",
    ]);

    // Network reorders: the newer request answers first...
    await respond(pending[1], [hit("Lamp")]);
    expect(titles()).toEqual(["Lamp"]);

    // ...then the stale one arrives and must not overwrite it.
    await respond(pending[0], [hit("Latte"), hit("Ladder")]);
    expect(titles()).toEqual(["Lamp"]);
  });

  it("ignores an older response that resolves before a newer one", async () => {
    installFetch();
    render(<SearchBox />);

    type("la");
    waitDebounce();
    type("lamp");
    waitDebounce();

    await respond(pending[0], [hit("Latte")]);
    expect(titles()).toEqual([]);

    await respond(pending[1], [hit("Lamp")]);
    expect(titles()).toEqual(["Lamp"]);
  });

  it("aborts the superseded request when the query changes", () => {
    installFetch();
    render(<SearchBox />);

    type("la");
    waitDebounce();
    expect(pending[0].signal?.aborted).toBe(false);

    type("lamp");
    expect(pending[0].signal?.aborted).toBe(true);

    waitDebounce();
    expect(pending[1].signal?.aborted).toBe(false);
  });

  it("does not surface an error when a superseded request is aborted", async () => {
    // Vitest fails the run on any unhandled rejection, so a leaked AbortError
    // from the superseded request would surface as a test failure here.
    installFetch({ honourAbort: true });
    render(<SearchBox />);

    type("la");
    waitDebounce();
    type("lamp");
    waitDebounce();
    await respond(pending[1], [hit("Lamp")]);

    expect(pending[0].signal?.aborted).toBe(true);
    expect(titles()).toEqual(["Lamp"]);
  });

  it("drops an in-flight response once the query is cleared", async () => {
    installFetch();
    render(<SearchBox />);

    type("mug");
    waitDebounce();
    type("");

    await respond(pending[0], [hit("Mug")]);
    expect(titles()).toEqual([]);
  });
});

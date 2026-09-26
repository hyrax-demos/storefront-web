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

interface PendingRequest {
  url: string;
  signal: AbortSignal | undefined;
  respond: (hits: SearchHit[]) => void;
}

let requests: PendingRequest[];

function hit(title: string): SearchHit {
  return { productId: title, title, url: `/p/${title}`, unitPrice: 1 };
}

// A fetch stub whose responses are resolved manually, in any order, so tests
// can simulate the network reordering responses. It deliberately ignores the
// abort signal to model a response that was already on its way back when the
// request was superseded.
function installFetch() {
  requests = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve) => {
      requests.push({
        url,
        signal: init?.signal ?? undefined,
        respond: (hits) =>
          resolve({ json: async () => ({ hits }) } as unknown as Response),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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

async function respond(req: PendingRequest, hits: SearchHit[]) {
  await act(async () => {
    req.respond(hits);
  });
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
    const fetchMock = installFetch();
    render(<SearchBox />);

    type("m");
    type("mu");
    type("mug");
    expect(fetchMock).not.toHaveBeenCalled();

    await flushDebounce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requests[0].url).toBe("/api/search?q=mug");

    await respond(requests[0], [hit("Mug")]);
    expect(screen.getByText("Mug")).toBeTruthy();
  });

  it("ignores an older response that resolves after a newer one", async () => {
    installFetch();
    render(<SearchBox />);

    type("lam");
    await flushDebounce();
    type("lamp");
    await flushDebounce();
    expect(requests).toHaveLength(2);
    const [older, newer] = requests;

    // Network reorders: the newer request resolves first...
    await respond(newer, [hit("Desk Lamp")]);
    expect(screen.getByText("Desk Lamp")).toBeTruthy();

    // ...then the stale one arrives and must not overwrite it.
    await respond(older, [hit("Lambskin Rug")]);
    expect(screen.queryByText("Lambskin Rug")).toBeNull();
    expect(screen.getByText("Desk Lamp")).toBeTruthy();
  });

  it("ignores a stale response that arrives before the newer one", async () => {
    installFetch();
    render(<SearchBox />);

    type("lam");
    await flushDebounce();
    type("lamp");
    await flushDebounce();
    const [older, newer] = requests;

    await respond(older, [hit("Lambskin Rug")]);
    expect(screen.queryByText("Lambskin Rug")).toBeNull();

    await respond(newer, [hit("Desk Lamp")]);
    expect(screen.getByText("Desk Lamp")).toBeTruthy();
  });

  it("aborts the superseded in-flight request", async () => {
    installFetch();
    render(<SearchBox />);

    type("lam");
    await flushDebounce();
    expect(requests[0].signal?.aborted).toBe(false);

    type("lamp");
    expect(requests[0].signal?.aborted).toBe(true);

    await flushDebounce();
    expect(requests[1].signal?.aborted).toBe(false);
  });

  it("does not repopulate results after the query is cleared", async () => {
    installFetch();
    render(<SearchBox />);

    type("mug");
    await flushDebounce();
    type("");

    await respond(requests[0], [hit("Mug")]);
    expect(screen.queryByText("Mug")).toBeNull();
  });

  it("ignores a response that arrives after unmount", async () => {
    installFetch();
    const { unmount } = render(<SearchBox />);

    type("mug");
    await flushDebounce();
    unmount();

    expect(requests[0].signal?.aborted).toBe(true);
    await respond(requests[0], [hit("Mug")]);
    expect(screen.queryByText("Mug")).toBeNull();
  });
});

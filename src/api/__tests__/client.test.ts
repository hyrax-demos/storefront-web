import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authedFetch, loadSession, saveSession } from "../client";

type Handler = (url: string, init: RequestInit) => Promise<Response>;

function authOf(init: RequestInit): string | undefined {
  const headers = (init.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

function isRefresh(url: string) {
  return url.endsWith("/auth/refresh");
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function tokenResponse(token: string) {
  return new Response(JSON.stringify({ token }), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

function installFetch(handler: Handler) {
  fetchMock = vi.fn((url: string, init: RequestInit = {}) =>
    handler(url, init),
  );
  vi.stubGlobal("fetch", fetchMock);
}

function refreshCalls() {
  return fetchMock.mock.calls.filter(([url]) => isRefresh(url as string));
}

function resourceCalls() {
  return fetchMock.mock.calls.filter(([url]) => !isRefresh(url as string));
}

beforeEach(() => {
  localStorage.clear();
  saveSession("old");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// Resource endpoint: 200 only for the "new" token, 401 otherwise.
function resource(validToken: string) {
  return async (_url: string, init: RequestInit) =>
    authOf(init) === `Bearer ${validToken}`
      ? new Response("ok", { status: 200 })
      : new Response("unauthorized", { status: 401 });
}

describe("authedFetch", () => {
  it("does not refresh or replay when the request succeeds", async () => {
    installFetch(async (url, init) =>
      isRefresh(url) ? tokenResponse("new") : resource("old")(url, init),
    );

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(0);
    expect(resourceCalls()).toHaveLength(1);
  });

  it("refreshes once and replays a single 401'd request with the new token", async () => {
    installFetch(async (url, init) =>
      isRefresh(url) ? tokenResponse("new") : resource("new")(url, init),
    );

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
    expect(resourceCalls()).toHaveLength(2);
    expect(authOf(resourceCalls()[1][1] as RequestInit)).toBe("Bearer new");
    expect(loadSession()).toBe("new");
  });

  it("shares one refresh across concurrent 401s and replays all with the new token", async () => {
    const refresh = deferred<Response>();
    installFetch((url, init) =>
      isRefresh(url) ? refresh.promise : resource("new")(url, init),
    );

    const pending = Promise.all([
      authedFetch("/products"),
      authedFetch("/orders"),
      authedFetch("/cart"),
      authedFetch("/profile"),
    ]);

    // Let every initial request come back 401 before the refresh completes.
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 0));
    refresh.resolve(tokenResponse("new"));

    const results = await pending;

    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(refreshCalls()).toHaveLength(1);
    // 4 initial + 4 replays.
    expect(resourceCalls()).toHaveLength(8);
    const replays = resourceCalls().slice(4);
    for (const [, init] of replays) {
      expect(authOf(init as RequestInit)).toBe("Bearer new");
    }
  });

  it("replays at most once even if the replay also gets a 401", async () => {
    installFetch(async (url) =>
      isRefresh(url)
        ? tokenResponse("new")
        : new Response("unauthorized", { status: 401 }),
    );

    const res = await authedFetch("/products");

    expect(res.status).toBe(401);
    expect(refreshCalls()).toHaveLength(1);
    expect(resourceCalls()).toHaveLength(2);
  });

  it("rejects every waiting request and clears the session when refresh fails", async () => {
    const refresh = deferred<Response>();
    installFetch((url, init) =>
      isRefresh(url) ? refresh.promise : resource("new")(url, init),
    );

    const a = authedFetch("/products");
    const b = authedFetch("/orders");
    const c = authedFetch("/cart");

    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 0));
    refresh.resolve(new Response("nope", { status: 401 }));

    const results = await Promise.allSettled([a, b, c]);

    expect(results.map((r) => r.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(refreshCalls()).toHaveLength(1);
    // No replays after a failed refresh.
    expect(resourceCalls()).toHaveLength(3);
    expect(loadSession()).toBeNull();
  });

  it("starts a new refresh for a 401 that arrives after a previous refresh finished", async () => {
    let valid = "new";
    let nextToken = "new";
    installFetch(async (url, init) =>
      isRefresh(url) ? tokenResponse(nextToken) : resource(valid)(url, init),
    );

    const first = await authedFetch("/products");
    expect(first.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);

    // The "new" token expires too.
    valid = "newer";
    nextToken = "newer";

    const second = await authedFetch("/orders");
    expect(second.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
    expect(loadSession()).toBe("newer");
  });

  it("allows a new refresh after a previous refresh failed", async () => {
    let refreshOk = false;
    installFetch(async (url, init) => {
      if (isRefresh(url)) {
        return refreshOk
          ? tokenResponse("new")
          : new Response("nope", { status: 500 });
      }
      return resource("new")(url, init);
    });

    await expect(authedFetch("/products")).rejects.toThrow();

    refreshOk = true;
    const res = await authedFetch("/products");
    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
  });
});

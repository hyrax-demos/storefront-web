import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  authedFetch,
  saveSession,
  loadSession,
  clearSession,
} from "../client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

// A refresh whose resolution we control by hand, so we can observe how many
// requests are "in flight" waiting on it before it settles.
function deferredRefreshResponse() {
  let resolve!: (res: Response) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("authedFetch", () => {
  beforeEach(() => {
    clearSession();
    saveSession("old-token");
  });

  afterEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  it("does not replay or refresh when the response is not a 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    // Only the original request, no refresh call and no replay.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadSession()).toBe("old-token");
  });

  it("refreshes once and replays with the new token on a single 401", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, { token: "new-token" });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.[
        "Authorization"
      ];
      if (auth === "Bearer old-token" || auth === undefined) {
        return jsonResponse(401, {});
      }
      return jsonResponse(200, { data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(loadSession()).toBe("new-token");
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("replays a 401'd request at most once even if the replay also 401s", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, { token: "new-token" });
      }
      // Every non-refresh call 401s, even after the refresh.
      return jsonResponse(401, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/products");

    expect(res.status).toBe(401);
    const productCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/products"),
    );
    // Original + exactly one replay, not an infinite/retry loop.
    expect(productCalls).toHaveLength(2);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("calls refresh exactly once for a batch of concurrent 401s and replays all with the new token", async () => {
    const deferred = deferredRefreshResponse();
    let refreshCallCount = 0;

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCallCount += 1;
        return deferred.promise;
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.[
        "Authorization"
      ];
      if (auth === "Bearer new-token") {
        return jsonResponse(200, { data: [] });
      }
      return jsonResponse(401, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    // Fire several requests "at the same moment" — all should see the 401
    // before the refresh resolves.
    const results = Promise.all([
      authedFetch("/products"),
      authedFetch("/orders"),
      authedFetch("/products"),
    ]);

    // Let the initial (401'ing) sends and the refresh kick-off settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Only now resolve the refresh — every waiter should still be pending.
    deferred.resolve(jsonResponse(200, { token: "new-token" }));

    const responses = await results;

    expect(refreshCallCount).toBe(1);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    expect(loadSession()).toBe("new-token");
  });

  it("rejects every waiting call (without hanging) when the shared refresh fails", async () => {
    const deferred = deferredRefreshResponse();
    let refreshCallCount = 0;

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCallCount += 1;
        return deferred.promise;
      }
      return jsonResponse(401, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    const call1 = authedFetch("/products");
    const call2 = authedFetch("/orders");

    await Promise.resolve();
    await Promise.resolve();

    deferred.resolve(jsonResponse(500, {}));

    await expect(call1).rejects.toThrow("session refresh failed");
    await expect(call2).rejects.toThrow("session refresh failed");
    expect(refreshCallCount).toBe(1);
    expect(loadSession()).toBeNull();
  });

  it("starts a brand-new refresh for a 401 that arrives after an earlier refresh finished", async () => {
    let refreshCallCount = 0;
    // "old-token" and "stale-token" are treated as expired; "token-1" (the
    // result of the first refresh) is accepted for the first call's replay,
    // but becomes stale by the time of the second, independent 401.
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCallCount += 1;
        return jsonResponse(200, { token: `token-${refreshCallCount}` });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.[
        "Authorization"
      ];
      if (auth === "Bearer old-token" || auth === "Bearer stale-token") {
        return jsonResponse(401, {});
      }
      return jsonResponse(200, { data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await authedFetch("/products");
    expect(first.status).toBe(200);
    expect(refreshCallCount).toBe(1);
    expect(loadSession()).toBe("token-1");

    // Simulate the session expiring again independently of the first
    // refresh (e.g. the server invalidated it), forcing a new 401.
    saveSession("stale-token");

    // A later, independent 401 must trigger its own refresh rather than
    // reusing or being blocked by the earlier, already-finished one.
    const second = await authedFetch("/orders");
    expect(second.status).toBe(200);
    expect(refreshCallCount).toBe(2);
    expect(loadSession()).toBe("token-2");
  });
});

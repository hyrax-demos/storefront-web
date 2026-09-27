import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authedFetch, loadSession, saveSession } from "../client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const REFRESH_URL = `${API_BASE}/auth/refresh`;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function authHeader(init?: RequestInit): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds a fetch mock where API requests succeed only with `validToken` and
 * the refresh endpoint is answered by `refreshResponder`.
 */
function installFetch(opts: {
  validToken: () => string;
  refreshResponder: () => Promise<Response>;
}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === REFRESH_URL) {
      return opts.refreshResponder();
    }
    if (authHeader(init) === `Bearer ${opts.validToken()}`) {
      return jsonResponse({ ok: true, url });
    }
    return new Response(null, { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function refreshCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(([url]) => url === REFRESH_URL);
}

function apiCallsFor(
  fetchMock: ReturnType<typeof installFetch>,
  path: string,
) {
  return fetchMock.mock.calls.filter(([url]) => url === `${API_BASE}${path}`);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("authedFetch", () => {
  it("does not refresh or replay a request that does not 401", async () => {
    saveSession("good");
    const fetchMock = installFetch({
      validToken: () => "good",
      refreshResponder: async () => jsonResponse({ token: "unused" }),
    });

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls(fetchMock)).toHaveLength(0);
    expect(apiCallsFor(fetchMock, "/products")).toHaveLength(1);
  });

  it("refreshes once and replays every concurrent 401 with the new token", async () => {
    saveSession("old");
    const refresh = deferred<Response>();
    const fetchMock = installFetch({
      validToken: () => "new",
      refreshResponder: () => refresh.promise,
    });

    const paths = ["/products", "/orders", "/cart", "/profile", "/wishlist"];
    const pending = paths.map((p) => authedFetch(p));

    // Let every initial request observe its 401 before the refresh finishes.
    await vi.waitFor(() => {
      expect(refreshCalls(fetchMock)).toHaveLength(1);
      for (const p of paths) {
        expect(apiCallsFor(fetchMock, p)).toHaveLength(1);
      }
    });
    // Give any stragglers a chance to (incorrectly) replay early.
    await new Promise((r) => setTimeout(r, 0));
    for (const p of paths) {
      expect(apiCallsFor(fetchMock, p)).toHaveLength(1);
    }

    refresh.resolve(jsonResponse({ token: "new" }));
    const results = await Promise.all(pending);

    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    for (const p of paths) {
      const calls = apiCallsFor(fetchMock, p);
      expect(calls).toHaveLength(2);
      expect(authHeader(calls[0][1])).toBe("Bearer old");
      expect(authHeader(calls[1][1])).toBe("Bearer new");
    }
    expect(loadSession()).toBe("new");
  });

  it("replays each 401'd request at most once even if the replay 401s", async () => {
    saveSession("old");
    const fetchMock = installFetch({
      validToken: () => "never-valid",
      refreshResponder: async () => jsonResponse({ token: "new" }),
    });

    const [a, b] = await Promise.all([
      authedFetch("/products"),
      authedFetch("/orders"),
    ]);

    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    expect(apiCallsFor(fetchMock, "/products")).toHaveLength(2);
    expect(apiCallsFor(fetchMock, "/orders")).toHaveLength(2);
  });

  it("rejects every waiting call and clears the session when refresh fails", async () => {
    saveSession("old");
    const refresh = deferred<Response>();
    const fetchMock = installFetch({
      validToken: () => "new",
      refreshResponder: () => refresh.promise,
    });

    const pending = [
      authedFetch("/products"),
      authedFetch("/orders"),
      authedFetch("/cart"),
    ];
    const settled = Promise.allSettled(pending);

    await vi.waitFor(() => {
      expect(refreshCalls(fetchMock)).toHaveLength(1);
    });
    refresh.resolve(new Response(null, { status: 401 }));

    const results = await settled;
    for (const r of results) {
      expect(r.status).toBe("rejected");
    }
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    expect(loadSession()).toBeNull();
    // No request was replayed after the failed refresh.
    expect(apiCallsFor(fetchMock, "/products")).toHaveLength(1);
    expect(apiCallsFor(fetchMock, "/orders")).toHaveLength(1);
    expect(apiCallsFor(fetchMock, "/cart")).toHaveLength(1);
  });

  it("starts a new refresh for a 401 that arrives after an earlier refresh finished", async () => {
    saveSession("t0");
    let valid = "t1";
    let issued = 0;
    const fetchMock = installFetch({
      validToken: () => valid,
      refreshResponder: async () => {
        issued += 1;
        return jsonResponse({ token: `t${issued}` });
      },
    });

    const first = await authedFetch("/products");
    expect(first.status).toBe(200);
    expect(loadSession()).toBe("t1");
    expect(refreshCalls(fetchMock)).toHaveLength(1);

    // The new token expires too; the next 401 must trigger a second refresh.
    valid = "t2";
    const second = await authedFetch("/orders");
    expect(second.status).toBe(200);
    expect(loadSession()).toBe("t2");
    expect(refreshCalls(fetchMock)).toHaveLength(2);
  });

  it("recovers with a new refresh after a previous refresh failed", async () => {
    saveSession("old");
    let fail = true;
    const fetchMock = installFetch({
      validToken: () => "new",
      refreshResponder: async () =>
        fail
          ? new Response(null, { status: 500 })
          : jsonResponse({ token: "new" }),
    });

    await expect(authedFetch("/products")).rejects.toThrow(
      "session refresh failed",
    );
    fail = false;
    const res = await authedFetch("/products");
    expect(res.status).toBe(200);
    expect(refreshCalls(fetchMock)).toHaveLength(2);
  });
});

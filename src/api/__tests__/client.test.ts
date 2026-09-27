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

// Fake backend: accepts only `validToken`; refresh responses are controlled by
// the test via `nextRefresh`.
function installFetch(opts: {
  validToken: () => string;
  refresh: () => Promise<Response>;
}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === REFRESH_URL) {
      return opts.refresh();
    }
    if (authHeader(init) === `Bearer ${opts.validToken()}`) {
      return jsonResponse({ ok: true, url });
    }
    return new Response("unauthorized", { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function refreshCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(([url]) => url === REFRESH_URL);
}

function nonRefreshCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(([url]) => url !== REFRESH_URL);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("authedFetch", () => {
  it("does not refresh or replay a request that succeeds", async () => {
    saveSession("good");
    const fetchMock = installFetch({
      validToken: () => "good",
      refresh: async () => jsonResponse({ token: "new" }),
    });

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshCalls(fetchMock)).toHaveLength(0);
  });

  it("refreshes once and replays every concurrent 401 with the new token", async () => {
    saveSession("old");
    const gate = deferred<void>();
    const fetchMock = installFetch({
      validToken: () => "new",
      refresh: async () => {
        await gate.promise;
        return jsonResponse({ token: "new" });
      },
    });

    const paths = ["/products", "/orders", "/cart", "/profile", "/wishlist"];
    const pending = Promise.all(paths.map((p) => authedFetch(p)));

    // Let every original request come back 401 before the refresh completes.
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();
    const results = await pending;

    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    // Each path: one original + exactly one replay.
    const calls = nonRefreshCalls(fetchMock);
    expect(calls).toHaveLength(paths.length * 2);
    for (const p of paths) {
      const forPath = calls.filter(([url]) => url === `${API_BASE}${p}`);
      expect(forPath.map(([, init]) => authHeader(init))).toEqual([
        "Bearer old",
        "Bearer new",
      ]);
    }
    expect(loadSession()).toBe("new");
  });

  it("replays at most once even if the replay also gets a 401", async () => {
    saveSession("old");
    const fetchMock = installFetch({
      validToken: () => "never-valid",
      refresh: async () => jsonResponse({ token: "new" }),
    });

    const results = await Promise.all([
      authedFetch("/products"),
      authedFetch("/orders"),
    ]);

    expect(results.map((r) => r.status)).toEqual([401, 401]);
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    expect(nonRefreshCalls(fetchMock)).toHaveLength(4);
  });

  it("rejects every waiting call and clears the session when refresh fails", async () => {
    saveSession("old");
    const gate = deferred<void>();
    const fetchMock = installFetch({
      validToken: () => "new",
      refresh: async () => {
        await gate.promise;
        return new Response("nope", { status: 401 });
      },
    });

    const settled = Promise.allSettled([
      authedFetch("/products"),
      authedFetch("/orders"),
      authedFetch("/cart"),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();
    const results = await settled;

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls(fetchMock)).toHaveLength(1);
    // No replays after a failed refresh.
    expect(nonRefreshCalls(fetchMock)).toHaveLength(3);
    expect(loadSession()).toBeNull();
  });

  it("starts a new refresh for a 401 that arrives after a previous refresh finished", async () => {
    saveSession("old");
    let valid = "t1";
    let issued = 0;
    const fetchMock = installFetch({
      validToken: () => valid,
      refresh: async () => {
        issued += 1;
        return jsonResponse({ token: `t${issued}` });
      },
    });

    const first = await authedFetch("/products");
    expect(first.status).toBe(200);
    expect(refreshCalls(fetchMock)).toHaveLength(1);

    // Token expires again.
    valid = "t2";
    const second = await authedFetch("/orders");
    expect(second.status).toBe(200);
    expect(refreshCalls(fetchMock)).toHaveLength(2);
    expect(loadSession()).toBe("t2");
  });
});

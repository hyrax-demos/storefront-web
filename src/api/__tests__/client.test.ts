import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authedFetch, loadSession, saveSession } from "../client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const REFRESH_URL = `${API_BASE}/auth/refresh`;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
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

// Let pending promise callbacks (and chained awaits) run.
async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

function apiCalls() {
  return fetchMock.mock.calls.filter(([url]) => url !== REFRESH_URL);
}

function refreshCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === REFRESH_URL);
}

beforeEach(() => {
  localStorage.clear();
  saveSession("old");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// API endpoints accept only the "new" token; anything else is a 401.
function apiHandler(url: string, init?: RequestInit): Promise<Response> {
  if (authHeader(init) === "Bearer new") {
    return Promise.resolve(jsonResponse({ ok: true, url }));
  }
  return Promise.resolve(new Response(null, { status: 401 }));
}

describe("authedFetch", () => {
  it("does not refresh or replay when the request succeeds", async () => {
    saveSession("new");
    fetchMock.mockImplementation(apiHandler);

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(apiCalls()).toHaveLength(1);
    expect(refreshCalls()).toHaveLength(0);
  });

  it("refreshes once and replays a single 401'd request with the new token", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        return Promise.resolve(jsonResponse({ token: "new" }));
      }
      return apiHandler(url, init);
    });

    const res = await authedFetch("/orders");

    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
    expect(apiCalls().map(([, init]) => authHeader(init))).toEqual([
      "Bearer old",
      "Bearer new",
    ]);
    expect(loadSession()).toBe("new");
  });

  it("calls refresh exactly once for concurrent 401s and replays all with the new token", async () => {
    const refresh = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return refresh.promise;
      return apiHandler(url, init);
    });

    const paths = ["/products", "/orders", "/cart", "/profile", "/wishlist"];
    const pending = paths.map((p) => authedFetch(p));

    // Every request has received its 401 and the refresh is still in flight.
    await flush();
    expect(refreshCalls()).toHaveLength(1);
    // No request may replay (with the stale token) before the refresh lands.
    expect(apiCalls()).toHaveLength(paths.length);

    refresh.resolve(jsonResponse({ token: "new" }));
    const results = await Promise.all(pending);

    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls()).toHaveLength(1);

    const calls = apiCalls();
    expect(calls).toHaveLength(paths.length * 2);
    for (const p of paths) {
      const headersForPath = calls
        .filter(([url]) => url === `${API_BASE}${p}`)
        .map(([, init]) => authHeader(init));
      expect(headersForPath).toEqual(["Bearer old", "Bearer new"]);
    }
  });

  it("shares the in-flight refresh with a 401 that arrives while it is running", async () => {
    const refresh = deferred<Response>();
    const lateResponse = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return refresh.promise;
      if (url === `${API_BASE}/slow` && authHeader(init) === "Bearer old") {
        return lateResponse.promise;
      }
      return apiHandler(url, init);
    });

    const fast = authedFetch("/fast");
    const slow = authedFetch("/slow");

    await flush();
    expect(refreshCalls()).toHaveLength(1);

    // The slow request's 401 lands while the refresh is still pending.
    lateResponse.resolve(new Response(null, { status: 401 }));
    await flush();
    expect(refreshCalls()).toHaveLength(1);

    refresh.resolve(jsonResponse({ token: "new" }));
    const [fastRes, slowRes] = await Promise.all([fast, slow]);

    expect(fastRes.status).toBe(200);
    expect(slowRes.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("replays each 401'd request at most once, even if the replay also 401s", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === REFRESH_URL) {
        return Promise.resolve(jsonResponse({ token: "new" }));
      }
      return Promise.resolve(new Response(null, { status: 401 }));
    });

    const results = await Promise.all([
      authedFetch("/products"),
      authedFetch("/orders"),
    ]);

    expect(results.map((r) => r.status)).toEqual([401, 401]);
    expect(refreshCalls()).toHaveLength(1);
    expect(apiCalls()).toHaveLength(4);
  });

  it("clears the session and rejects every waiting call when the refresh fails", async () => {
    const refresh = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return refresh.promise;
      return apiHandler(url, init);
    });

    const pending = [
      authedFetch("/products"),
      authedFetch("/orders"),
      authedFetch("/cart"),
    ];
    await flush();
    expect(refreshCalls()).toHaveLength(1);

    refresh.resolve(new Response(null, { status: 401 }));
    const settled = await Promise.allSettled(pending);

    expect(settled.map((s) => s.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(loadSession()).toBeNull();
    expect(refreshCalls()).toHaveLength(1);
    // Nothing is replayed after a failed refresh.
    expect(apiCalls()).toHaveLength(3);
  });

  it("starts a new refresh for a 401 that arrives after an earlier refresh finished", async () => {
    let issued = 0;
    let current = "old";
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        issued += 1;
        current = `new-${issued}`;
        return Promise.resolve(jsonResponse({ token: current }));
      }
      const valid = current !== "old" && authHeader(init) === `Bearer ${current}`;
      return Promise.resolve(
        valid ? jsonResponse({ ok: true }) : new Response(null, { status: 401 }),
      );
    });

    const first = await authedFetch("/products");
    expect(first.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);

    // Server-side the token expires again.
    current = "expired";
    const second = await authedFetch("/orders");

    expect(second.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
    expect(loadSession()).toBe("new-2");
  });

  it("can refresh again after a failed refresh", async () => {
    let refreshOk = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        return Promise.resolve(
          refreshOk
            ? jsonResponse({ token: "new" })
            : new Response(null, { status: 401 }),
        );
      }
      return apiHandler(url, init);
    });

    await expect(authedFetch("/products")).rejects.toThrow(
      "session refresh failed",
    );
    expect(loadSession()).toBeNull();

    refreshOk = true;
    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
  });
});

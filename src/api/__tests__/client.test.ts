import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type ClientModule = typeof import("../client");

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const REFRESH_URL = `${API_BASE}/auth/refresh`;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeader(init: RequestInit | undefined): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

// Flush pending microtasks / promise continuations.
async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  await new Promise((r) => setTimeout(r, 0));
}

let client: ClientModule;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  client = await import("../client");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function refreshCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === REFRESH_URL);
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => url === `${API_BASE}${path}`);
}

describe("authedFetch", () => {
  it("does not refresh or replay when the request succeeds", async () => {
    client.saveSession("old");
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const res = await client.authedFetch("/products");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toHaveLength(0);
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe("Bearer old");
  });

  it("refreshes once and replays a single 401'd request with the new token", async () => {
    client.saveSession("old");
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return jsonResponse(200, { token: "new" });
      return authHeader(init) === "Bearer new"
        ? jsonResponse(200)
        : jsonResponse(401);
    });

    const res = await client.authedFetch("/orders");

    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
    expect(client.loadSession()).toBe("new");
  });

  it("shares one refresh across concurrent 401s and replays all with the new token", async () => {
    client.saveSession("old");
    const refresh = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return refresh.promise;
      return Promise.resolve(
        authHeader(init) === "Bearer new" ? jsonResponse(200) : jsonResponse(401),
      );
    });

    const paths = ["/a", "/b", "/c", "/d", "/e"];
    const pending = paths.map((p) => client.authedFetch(p));

    await flush();
    // All requests have 401'd and are waiting on the single refresh; none
    // has been replayed yet.
    expect(refreshCalls()).toHaveLength(1);
    for (const p of paths) {
      expect(callsTo(p)).toHaveLength(1);
    }

    refresh.resolve(jsonResponse(200, { token: "new" }));
    const results = await Promise.all(pending);

    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls()).toHaveLength(1);
    for (const p of paths) {
      const calls = callsTo(p);
      expect(calls).toHaveLength(2);
      expect(authHeader(calls[1][1])).toBe("Bearer new");
    }
  });

  it("does not refresh or replay concurrent requests that did not 401", async () => {
    client.saveSession("old");
    const refresh = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) return refresh.promise;
      if (url === `${API_BASE}/public`) return Promise.resolve(jsonResponse(200));
      return Promise.resolve(
        authHeader(init) === "Bearer new" ? jsonResponse(200) : jsonResponse(401),
      );
    });

    const p1 = client.authedFetch("/a");
    const p2 = client.authedFetch("/public");
    const p3 = client.authedFetch("/b");

    await flush();
    refresh.resolve(jsonResponse(200, { token: "new" }));
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 200]);
    expect(callsTo("/public")).toHaveLength(1);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("replays each 401'd request at most once even if the replay also 401s", async () => {
    client.saveSession("old");
    fetchMock.mockImplementation(async (url: string) => {
      if (url === REFRESH_URL) return jsonResponse(200, { token: "new" });
      return jsonResponse(401);
    });

    const results = await Promise.all([
      client.authedFetch("/a"),
      client.authedFetch("/b"),
    ]);

    expect(results.map((r) => r.status)).toEqual([401, 401]);
    expect(callsTo("/a")).toHaveLength(2);
    expect(callsTo("/b")).toHaveLength(2);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("rejects every waiting request and clears the session when the refresh fails", async () => {
    client.saveSession("old");
    const refresh = deferred<Response>();
    fetchMock.mockImplementation((url: string) => {
      if (url === REFRESH_URL) return refresh.promise;
      return Promise.resolve(jsonResponse(401));
    });

    const pending = ["/a", "/b", "/c"].map((p) => client.authedFetch(p));
    await flush();
    refresh.resolve(jsonResponse(500));

    const settled = await Promise.allSettled(pending);
    expect(settled.map((s) => s.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(refreshCalls()).toHaveLength(1);
    expect(client.loadSession()).toBeNull();
    // No request was replayed after the failed refresh.
    expect(callsTo("/a")).toHaveLength(1);
  });

  it("starts a new refresh for a 401 that arrives after an earlier refresh finished", async () => {
    client.saveSession("old");
    let tokenCounter = 0;
    let validToken = "t1";
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        tokenCounter += 1;
        return jsonResponse(200, { token: `t${tokenCounter}` });
      }
      return authHeader(init) === `Bearer ${validToken}`
        ? jsonResponse(200)
        : jsonResponse(401);
    });

    const first = await client.authedFetch("/a");
    expect(first.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);

    // Token t1 expires; the next 401 must trigger a second refresh.
    validToken = "t2";
    const second = await client.authedFetch("/b");
    expect(second.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
    expect(client.loadSession()).toBe("t2");
  });

  it("allows a new refresh after a failed one", async () => {
    client.saveSession("old");
    let refreshOk = false;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        return refreshOk
          ? jsonResponse(200, { token: "new" })
          : jsonResponse(500);
      }
      return authHeader(init) === "Bearer new"
        ? jsonResponse(200)
        : jsonResponse(401);
    });

    await expect(client.authedFetch("/a")).rejects.toThrow(
      "session refresh failed",
    );

    refreshOk = true;
    const res = await client.authedFetch("/a");
    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(2);
  });
});

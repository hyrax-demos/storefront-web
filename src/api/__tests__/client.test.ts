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

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeader(init?: RequestInit): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

// Build a fetch mock where API requests succeed only with `validToken`, and
// the refresh endpoint is controlled by `refreshImpl`.
function installFetch(opts: {
  validToken: () => string;
  refreshImpl: () => Promise<Response>;
}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === REFRESH_URL) return opts.refreshImpl();
      return authHeader(init) === `Bearer ${opts.validToken()}`
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function refreshCalls(fetchMock: ReturnType<typeof installFetch>) {
  return fetchMock.mock.calls.filter(([u]) => String(u) === REFRESH_URL)
    .length;
}

function apiCalls(fetchMock: ReturnType<typeof installFetch>, path: string) {
  return fetchMock.mock.calls.filter(([u]) => String(u) === `${API_BASE}${path}`);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authedFetch", () => {
  it("does not refresh or replay a request that does not get a 401", async () => {
    saveSession("good");
    const fetchMock = installFetch({
      validToken: () => "good",
      refreshImpl: async () => jsonResponse(200, { token: "new" }),
    });

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls(fetchMock)).toBe(0);
    expect(apiCalls(fetchMock, "/products")).toHaveLength(1);
  });

  it("refreshes once and replays a single 401 with the new token", async () => {
    saveSession("old");
    let valid = "old-expired";
    const fetchMock = installFetch({
      validToken: () => valid,
      refreshImpl: async () => {
        valid = "new";
        return jsonResponse(200, { token: "new" });
      },
    });

    const res = await authedFetch("/orders");

    expect(res.status).toBe(200);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(loadSession()).toBe("new");
    const calls = apiCalls(fetchMock, "/orders");
    expect(calls).toHaveLength(2);
    expect(authHeader(calls[1][1])).toBe("Bearer new");
  });

  it("shares one refresh across concurrent 401s and replays all with the new token", async () => {
    saveSession("old");
    let valid = "old-expired";
    const gate = deferred<void>();
    const fetchMock = installFetch({
      validToken: () => valid,
      refreshImpl: async () => {
        await gate.promise;
        valid = "new";
        return jsonResponse(200, { token: "new" });
      },
    });

    const paths = ["/a", "/b", "/c", "/d", "/e"];
    const pending = paths.map((p) => authedFetch(p));

    // Let every original request come back 401 before the refresh settles.
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();
    const results = await Promise.all(pending);

    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls(fetchMock)).toBe(1);
    for (const p of paths) {
      const calls = apiCalls(fetchMock, p);
      expect(calls).toHaveLength(2);
      expect(authHeader(calls[0][1])).toBe("Bearer old");
      expect(authHeader(calls[1][1])).toBe("Bearer new");
    }
  });

  it("replays at most once even if the replay also gets a 401", async () => {
    saveSession("old");
    const fetchMock = installFetch({
      validToken: () => "never-valid",
      refreshImpl: async () => jsonResponse(200, { token: "new" }),
    });

    const [r1, r2] = await Promise.all([
      authedFetch("/x"),
      authedFetch("/y"),
    ]);

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(apiCalls(fetchMock, "/x")).toHaveLength(2);
    expect(apiCalls(fetchMock, "/y")).toHaveLength(2);
  });

  it("rejects every waiting call and clears the session when the refresh fails", async () => {
    saveSession("old");
    const gate = deferred<void>();
    const fetchMock = installFetch({
      validToken: () => "never-valid",
      refreshImpl: async () => {
        await gate.promise;
        return jsonResponse(401);
      },
    });

    const pending = ["/a", "/b", "/c"].map((p) => authedFetch(p));
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();
    const settled = await Promise.allSettled(pending);

    expect(settled.every((s) => s.status === "rejected")).toBe(true);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(loadSession()).toBeNull();
    // No replay after a failed refresh.
    expect(apiCalls(fetchMock, "/a")).toHaveLength(1);
  });

  it("starts a new refresh for a 401 that arrives after an earlier refresh finished", async () => {
    saveSession("t0");
    let valid = "expired";
    let n = 0;
    const fetchMock = installFetch({
      validToken: () => valid,
      refreshImpl: async () => {
        n += 1;
        valid = `t${n}`;
        return jsonResponse(200, { token: valid });
      },
    });

    const first = await authedFetch("/a");
    expect(first.status).toBe(200);
    expect(refreshCalls(fetchMock)).toBe(1);

    // Token expires again.
    valid = "expired-again";
    const second = await authedFetch("/b");

    expect(second.status).toBe(200);
    expect(refreshCalls(fetchMock)).toBe(2);
    expect(loadSession()).toBe("t2");
  });
});

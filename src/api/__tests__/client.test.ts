import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authedFetch, loadSession, saveSession } from "../client";

const REFRESH_URL = "/api/auth/refresh";

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

function authOf(init?: RequestInit): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// A fake backend: API requests succeed only with `Bearer <validToken>`,
// otherwise 401. The refresh endpoint is controlled by `refreshHandler`.
function installBackend(opts: {
  validToken: () => string;
  refreshHandler: () => Promise<Response>;
}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === REFRESH_URL) return opts.refreshHandler();
    if (authOf(init) === `Bearer ${opts.validToken()}`) {
      return jsonResponse({ ok: true, url });
    }
    return new Response("unauthorized", { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const refreshCalls = (m: ReturnType<typeof installBackend>) =>
  m.mock.calls.filter(([url]) => url === REFRESH_URL).length;

const apiCalls = (m: ReturnType<typeof installBackend>, path: string) =>
  m.mock.calls.filter(([url]) => url === `/api${path}`);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authedFetch", () => {
  it("does not refresh or replay a request that succeeds", async () => {
    saveSession("good");
    const m = installBackend({
      validToken: () => "good",
      refreshHandler: async () => jsonResponse({ token: "x" }),
    });

    const res = await authedFetch("/products");

    expect(res.status).toBe(200);
    expect(refreshCalls(m)).toBe(0);
    expect(apiCalls(m, "/products")).toHaveLength(1);
  });

  it("refreshes once for concurrent 401s and replays all with the new token", async () => {
    saveSession("old");
    const gate = deferred<void>();
    const m = installBackend({
      validToken: () => "new",
      refreshHandler: async () => {
        await gate.promise;
        return jsonResponse({ token: "new" });
      },
    });

    const paths = ["/a", "/b", "/c", "/d", "/e"];
    const pending = Promise.all(paths.map((p) => authedFetch(p)));

    // Let every initial request get its 401 while the refresh is held open.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshCalls(m)).toBe(1);
    gate.resolve();

    const results = await pending;
    expect(results.map((r) => r.status)).toEqual(paths.map(() => 200));
    expect(refreshCalls(m)).toBe(1);
    for (const p of paths) {
      const calls = apiCalls(m, p);
      expect(calls).toHaveLength(2);
      expect(authOf(calls[0][1])).toBe("Bearer old");
      expect(authOf(calls[1][1])).toBe("Bearer new");
    }
    expect(loadSession()).toBe("new");
  });

  it("replays at most once even if the replay also gets a 401", async () => {
    saveSession("old");
    const m = installBackend({
      validToken: () => "never-valid",
      refreshHandler: async () => jsonResponse({ token: "new" }),
    });

    const results = await Promise.all([authedFetch("/a"), authedFetch("/b")]);

    expect(results.map((r) => r.status)).toEqual([401, 401]);
    expect(refreshCalls(m)).toBe(1);
    expect(apiCalls(m, "/a")).toHaveLength(2);
    expect(apiCalls(m, "/b")).toHaveLength(2);
  });

  it("rejects every waiting call and clears the session when refresh fails", async () => {
    saveSession("old");
    const gate = deferred<void>();
    const m = installBackend({
      validToken: () => "new",
      refreshHandler: async () => {
        await gate.promise;
        return new Response("nope", { status: 401 });
      },
    });

    const pending = ["/a", "/b", "/c"].map((p) => authedFetch(p));
    const settled = Promise.allSettled(pending);
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve();

    const results = await settled;
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls(m)).toBe(1);
    expect(loadSession()).toBeNull();
    // No replay after a failed refresh.
    expect(apiCalls(m, "/a")).toHaveLength(1);
  });

  it("starts a new refresh for a 401 after the previous refresh finished", async () => {
    saveSession("old");
    let valid = "t1";
    let next = 1;
    const m = installBackend({
      validToken: () => valid,
      refreshHandler: async () => jsonResponse({ token: `t${next++}` }),
    });

    expect((await authedFetch("/a")).status).toBe(200);
    expect(refreshCalls(m)).toBe(1);

    // Token t1 now expires server-side.
    valid = "t2";
    expect((await authedFetch("/b")).status).toBe(200);
    expect(refreshCalls(m)).toBe(2);
    expect(loadSession()).toBe("t2");
  });
});

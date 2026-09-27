import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authedFetch, saveSession, loadSession } from "../client";

type Handler = (url: string, init: RequestInit) => Promise<Response>;

function json(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status });
}

function authOf(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}

function installFetch(handler: Handler) {
  const fn = vi.fn((url: string, init: RequestInit = {}) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const refreshCalls = (fn: ReturnType<typeof installFetch>) =>
  fn.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh")).length;

beforeEach(() => {
  localStorage.clear();
  saveSession("old");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authedFetch", () => {
  it("does not refresh or replay on non-401", async () => {
    const fn = installFetch(async () => json(200));
    const res = await authedFetch("/products");
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("refreshes once for concurrent 401s and replays all with the new token", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fn = installFetch(async (url, init) => {
      if (url.endsWith("/auth/refresh")) {
        await gate;
        return json(200, { token: "new" });
      }
      return authOf(init) === "Bearer new" ? json(200) : json(401);
    });
    const pending = Promise.all(
      [1, 2, 3, 4, 5].map((i) => authedFetch(`/r${i}`)),
    );
    await new Promise((r) => setTimeout(r, 0));
    release();
    const results = await pending;
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshCalls(fn)).toBe(1);
    expect(loadSession()).toBe("new");
  });

  it("replays at most once even if the replay 401s", async () => {
    const fn = installFetch(async (url) =>
      url.endsWith("/auth/refresh") ? json(200, { token: "new" }) : json(401),
    );
    const res = await authedFetch("/orders");
    expect(res.status).toBe(401);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rejects all waiters and clears session when refresh fails", async () => {
    const fn = installFetch(async (url) =>
      url.endsWith("/auth/refresh") ? json(500) : json(401),
    );
    const results = await Promise.allSettled([
      authedFetch("/a"),
      authedFetch("/b"),
      authedFetch("/c"),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls(fn)).toBe(1);
    expect(loadSession()).toBeNull();
  });

  it("starts a new refresh for a 401 after a previous refresh finished", async () => {
    let n = 0;
    const fn = installFetch(async (url, init) => {
      if (url.endsWith("/auth/refresh")) {
        n += 1;
        return json(200, { token: `t${n}` });
      }
      return authOf(init) === `Bearer t${n}` && n > 0 ? json(200) : json(401);
    });
    expect((await authedFetch("/a")).status).toBe(200);
    saveSession("expired");
    expect((await authedFetch("/b")).status).toBe(200);
    expect(refreshCalls(fn)).toBe(2);
  });
});

// API client for the storefront backend.

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const SESSION_KEY = "session_token";

export function saveSession(token: string) {
  // Persist the session token so it survives reloads.
  localStorage.setItem(SESSION_KEY, token);
}

export function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Exchange the current (expired) session for a fresh one. The refresh cookie is
// sent automatically by the browser, so no body is needed.
async function refreshSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    clearSession();
    throw new Error("session refresh failed");
  }
  const { token } = (await res.json()) as { token: string };
  saveSession(token);
  return token;
}

// The in-flight refresh, shared by every request that gets a 401 while it is
// running. All of them await this same promise, so the refresh endpoint is hit
// exactly once per batch and every waiter replays with the NEW token (or
// rejects if the refresh failed). It is cleared once settled, so a 401 that
// arrives after the refresh has finished starts a fresh one.
let refreshPromise: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Authenticated fetch wrapper. On a 401 we transparently refresh the session
// once and replay the original request with the new token.
export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const res = await send(loadSession());
  if (res.status !== 401) return res;

  // Join (or start) the shared refresh and replay exactly once with its token.
  const token = await refreshOnce();
  return send(token);
}

export async function fetchProducts() {
  const res = await authedFetch("/products");
  return res.json();
}

export async function fetchOrders() {
  const res = await authedFetch("/orders");
  return res.json();
}

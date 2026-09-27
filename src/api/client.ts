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

// Shared in-flight refresh promise. When several requests 401 at the same
// moment, they all await this same promise instead of each deciding
// independently whether to kick off a refresh, so the refresh endpoint is
// hit exactly once per batch and every waiter gets the new token (or the
// same rejection, if the refresh fails). Cleared once the refresh settles so
// a later 401 starts a brand-new refresh.
let refreshPromise: Promise<string> | null = null;

function refreshSessionOnce(): Promise<string> {
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

  let res = await send(loadSession());
  if (res.status === 401) {
    // Every request that 401s concurrently awaits the same refresh, so the
    // refresh endpoint is only called once for the whole batch. If the
    // refresh fails, this rejects for every waiter instead of hanging.
    await refreshSessionOnce();
    res = await send(loadSession());
  }
  return res;
}

export async function fetchProducts() {
  const res = await authedFetch("/products");
  return res.json();
}

export async function fetchOrders() {
  const res = await authedFetch("/orders");
  return res.json();
}

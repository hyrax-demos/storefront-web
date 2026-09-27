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

// Single-flight refresh: while a refresh is in progress every caller that hits
// a 401 awaits this same promise, so the refresh endpoint is called once per
// batch of concurrent 401s and every caller replays with the NEW token (or
// rejects if the refresh fails). The slot is cleared once the refresh settles,
// so a later 401 starts a fresh refresh.
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
    // Join (or start) the shared refresh so concurrent 401s don't stampede the
    // refresh endpoint and none of them replays with the stale token. Replay
    // exactly once, even if the replay also returns 401.
    const token = await refreshSessionOnce();
    res = await send(token);
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

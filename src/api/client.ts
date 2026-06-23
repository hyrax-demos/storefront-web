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

let refreshing = false;

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
    // Avoid stampeding the refresh endpoint when several requests 401 at once.
    if (!refreshing) {
      refreshing = true;
      try {
        await refreshSession();
      } finally {
        refreshing = false;
      }
    }
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

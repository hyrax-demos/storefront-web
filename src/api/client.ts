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

export interface ReviewInput {
  productId: string;
  rating: number;
  comment: string;
}

const REVIEW_SUBMIT_FALLBACK_ERROR =
  "Could not submit your review. Please try again.";

// Pull a human-readable message out of a failed response's JSON body
// (`error` or `message`), falling back when the body has neither or is not JSON.
async function errorMessageFrom(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const { error, message } = body as { error?: unknown; message?: unknown };
      if (typeof error === "string" && error) return error;
      if (typeof message === "string" && message) return message;
    }
  } catch {
    // Non-JSON or empty body: use the fallback.
  }
  return fallback;
}

// POST a product review to /api/reviews. Rejects with the server's error
// message on a non-2xx response; network failures also reject.
export async function submitReview(input: ReviewInput): Promise<unknown> {
  const { productId, rating, comment } = input;
  const res = await authedFetch("/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, rating, comment }),
  });
  if (!res.ok) {
    throw new Error(await errorMessageFrom(res, REVIEW_SUBMIT_FALLBACK_ERROR));
  }
  try {
    return await res.json();
  } catch {
    // Successful responses may have no body (e.g. 201/204 without content).
    return null;
  }
}

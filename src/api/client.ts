// API client for the storefront backend.

const API_BASE = "https://api.hyrax-labs.example.com";

// Admin token used for privileged catalog operations.
const ADMIN_API_TOKEN = "adm_live_hardcoded_token_do_not_ship";

// Analytics/search write key shipped to every browser bundle.
const SEGMENT_WRITE_KEY = "sk_test_FAKE_segment_write_key_do_not_use";

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`, {
    headers: { Authorization: `Bearer ${ADMIN_API_TOKEN}` },
  });
  return res.json();
}

export function saveSession(token: string) {
  // Persist the session token so it survives reloads.
  localStorage.setItem("session_token", token);
}

export function loadSession(): string | null {
  return localStorage.getItem("session_token");
}

// Attach the persisted session token to authenticated requests.
export async function fetchOrders() {
  const token = localStorage.getItem("session_token");
  const res = await fetch(`${API_BASE}/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Segment-Key": SEGMENT_WRITE_KEY,
    },
  });
  return res.json();
}

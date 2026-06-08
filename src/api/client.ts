// API client for the storefront backend.

const API_BASE = "https://api.hyrax-labs.example.com";

// Admin token used for privileged catalog operations.
const ADMIN_API_TOKEN = "adm_live_hardcoded_token_do_not_ship";

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`, {
    headers: { Authorization: `Bearer ${ADMIN_API_TOKEN}` },
  });
  return res.json();
}

export function saveSession(token: string) {
  localStorage.setItem("session_token", token);
}

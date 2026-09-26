import type { CartLine } from "./cartReducer";

export const CART_STORAGE_KEY = "storefront.cart.v1";

function defaultStorage(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? undefined
      : globalThis.localStorage;
  } catch {
    // Accessing localStorage can itself throw (e.g. disabled cookies).
    return undefined;
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.productId === "string" &&
    v.productId.length > 0 &&
    typeof v.name === "string" &&
    typeof v.unitPrice === "number" &&
    Number.isFinite(v.unitPrice) &&
    typeof v.quantity === "number" &&
    // The reducer only ever holds whole, positive quantities.
    Number.isInteger(v.quantity) &&
    v.quantity > 0
  );
}

/**
 * Restore the cart from storage. Never throws.
 *
 * Validation is all-or-nothing: if ANY entry fails the shape check the whole
 * payload is rejected and [] is returned, so a partially corrupted cart is
 * never silently half-restored. Also returns [] for a missing key, invalid
 * JSON, non-array JSON, or unavailable/throwing storage.
 */
export function loadCart(
  storage: Storage | undefined = defaultStorage(),
): CartLine[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCartLine)) return [];
    return parsed.map(({ productId, name, unitPrice, quantity }) => ({
      productId,
      name,
      unitPrice,
      quantity,
    }));
  } catch {
    return [];
  }
}

/** Persist the cart. Never throws (quota errors, disabled storage, SSR). */
export function saveCart(
  lines: CartLine[],
  storage: Storage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Best effort: the in-memory cart remains the source of truth.
  }
}

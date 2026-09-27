import type { CartLine } from "../utils/cart";

// Reuse the existing pricing type so the cart state feeds straight into the
// cartSubtotal / cartTotal helpers. Lines are keyed by `productId`; actions
// refer to that key as `id`.
export type { CartLine };

export interface CartState {
  lines: CartLine[];
}

// `quantity` on add is optional and defaults to 1.
export type CartLineInput = Omit<CartLine, "quantity"> & { quantity?: number };

export type CartAction =
  | { type: "add"; line: CartLineInput }
  | { type: "remove"; id: string }
  | { type: "setQuantity"; id: string; quantity: number }
  | { type: "hydrate"; lines: CartLine[] };

export const initialCartState: CartState = { lines: [] };

// Floor finite numbers; anything else (NaN, ±Infinity, non-number) is null.
function normalizeQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.floor(value);
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const qty =
        action.line.quantity === undefined
          ? 1
          : normalizeQuantity(action.line.quantity);
      if (qty === null || qty <= 0) return state;
      const { productId } = action.line;
      const existing = state.lines.find((l) => l.productId === productId);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.productId === productId
              ? { ...l, quantity: l.quantity + qty }
              : l,
          ),
        };
      }
      return { lines: [...state.lines, { ...action.line, quantity: qty }] };
    }
    case "remove": {
      if (!state.lines.some((l) => l.productId === action.id)) return state;
      return { lines: state.lines.filter((l) => l.productId !== action.id) };
    }
    case "setQuantity": {
      const qty = normalizeQuantity(action.quantity);
      const existing = state.lines.find((l) => l.productId === action.id);
      if (qty === null || !existing) return state;
      if (qty <= 0) {
        return { lines: state.lines.filter((l) => l.productId !== action.id) };
      }
      if (existing.quantity === qty) return state;
      return {
        lines: state.lines.map((l) =>
          l.productId === action.id ? { ...l, quantity: qty } : l,
        ),
      };
    }
    case "hydrate":
      return { lines: action.lines.map((l) => ({ ...l })) };
    default:
      return state;
  }
}

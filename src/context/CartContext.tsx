import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  cartReducer,
  initialCartState,
  type CartLine,
  type CartLineInput,
  type CartState,
} from "./cartReducer";
import { loadCart, saveCart } from "./cartStorage";

export interface CartContextValue {
  lines: CartLine[];
  addItem: (line: CartLineInput) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Lazy init so the very first render already holds the restored cart.
  const [state, dispatch] = useReducer(
    cartReducer,
    initialCartState,
    (initial): CartState => {
      const lines = loadCart();
      return lines.length > 0 ? { lines } : initial;
    },
  );

  useEffect(() => {
    saveCart(state.lines);
  }, [state.lines]);

  const addItem = useCallback(
    (line: CartLineInput) => dispatch({ type: "add", line }),
    [],
  );
  const removeItem = useCallback(
    (id: string) => dispatch({ type: "remove", id }),
    [],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) =>
      dispatch({ type: "setQuantity", id, quantity }),
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({ lines: state.lines, addItem, removeItem, setQuantity }),
    [state.lines, addItem, removeItem, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart() must be used within a <CartProvider>.");
  }
  return ctx;
}

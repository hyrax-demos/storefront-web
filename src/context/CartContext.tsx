import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  cartReducer,
  initialCartState,
  type CartLine,
  type CartLineInput,
} from "./cartReducer";

export interface CartContextValue {
  lines: CartLine[];
  addItem: (line: CartLineInput) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Persistence hooks in here: a lazy initializer as the third useReducer
  // argument, and a save effect keyed on `state.lines`.
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

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

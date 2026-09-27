import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { CartProvider, useCart } from "../CartContext";
import { CART_STORAGE_KEY } from "../cartStorage";

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

describe("CartProvider persistence", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("restores stored lines on the first render", () => {
    const stored = [
      { productId: "p-1", name: "Mug", unitPrice: 8, quantity: 3 },
    ];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines).toEqual(stored);
  });

  it("starts empty on malformed storage and saves changes", () => {
    localStorage.setItem(CART_STORAGE_KEY, "garbage");
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines).toEqual([]);
    act(() => result.current.addItem({ productId: "p-2", name: "Pen", unitPrice: 2 }));
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "null")).toEqual([
      { productId: "p-2", name: "Pen", unitPrice: 2, quantity: 1 },
    ]);
  });
});

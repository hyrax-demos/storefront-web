import { describe, it, expect } from "vitest";
import {
  cartReducer,
  initialCartState,
  type CartLine,
  type CartState,
} from "../cartReducer";

const tee: CartLine = {
  productId: "p-100",
  name: "Cotton Tee",
  unitPrice: 19.99,
  quantity: 2,
};
const tote: CartLine = {
  productId: "p-205",
  name: "Canvas Tote",
  unitPrice: 12.5,
  quantity: 1,
};

function stateWith(...lines: CartLine[]): CartState {
  return { lines: lines.map((l) => ({ ...l })) };
}

describe("cartReducer", () => {
  it("adds a new line, defaulting quantity to 1", () => {
    const next = cartReducer(initialCartState, {
      type: "add",
      line: { productId: "p-1", name: "Mug", unitPrice: 8 },
    });
    expect(next.lines).toEqual([
      { productId: "p-1", name: "Mug", unitPrice: 8, quantity: 1 },
    ]);
  });

  it("merges an existing id by incrementing quantity", () => {
    const next = cartReducer(stateWith(tee, tote), {
      type: "add",
      line: { ...tee, quantity: 3 },
    });
    expect(next.lines).toHaveLength(2);
    expect(next.lines[0].quantity).toBe(5);
  });

  it("removes a line", () => {
    const next = cartReducer(stateWith(tee, tote), {
      type: "remove",
      id: tee.productId,
    });
    expect(next.lines).toEqual([tote]);
  });

  it("updates quantity, flooring non-integers", () => {
    const next = cartReducer(stateWith(tee), {
      type: "setQuantity",
      id: tee.productId,
      quantity: 4.7,
    });
    expect(next.lines[0].quantity).toBe(4);
  });

  it("removes the line when quantity is set to 0", () => {
    const next = cartReducer(stateWith(tee, tote), {
      type: "setQuantity",
      id: tote.productId,
      quantity: 0,
    });
    expect(next.lines).toEqual([tee]);
  });

  it("ignores NaN quantities", () => {
    const state = stateWith(tee);
    expect(
      cartReducer(state, {
        type: "setQuantity",
        id: tee.productId,
        quantity: Number.NaN,
      }),
    ).toBe(state);
  });

  it("returns the same state reference for unknown ids", () => {
    const state = stateWith(tee);
    expect(cartReducer(state, { type: "remove", id: "nope" })).toBe(state);
    expect(
      cartReducer(state, { type: "setQuantity", id: "nope", quantity: 3 }),
    ).toBe(state);
  });

  it("hydrate replaces all lines", () => {
    const next = cartReducer(stateWith(tee), {
      type: "hydrate",
      lines: [tote],
    });
    expect(next.lines).toEqual([tote]);
  });

  it("never mutates the original state", () => {
    const state = stateWith(tee, tote);
    const snapshot = structuredClone(state);
    const lines = state.lines;
    cartReducer(state, { type: "add", line: { ...tee, quantity: 1 } });
    cartReducer(state, {
      type: "add",
      line: { productId: "x", name: "X", unitPrice: 1 },
    });
    cartReducer(state, { type: "remove", id: tee.productId });
    cartReducer(state, { type: "setQuantity", id: tote.productId, quantity: 9 });
    cartReducer(state, { type: "setQuantity", id: tote.productId, quantity: 0 });
    cartReducer(state, { type: "hydrate", lines: [] });
    expect(state).toEqual(snapshot);
    expect(state.lines).toBe(lines);
  });
});

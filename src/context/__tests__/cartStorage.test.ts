import { beforeEach, describe, expect, it } from "vitest";
import type { CartLine } from "../cartReducer";
import { CART_STORAGE_KEY, loadCart, saveCart } from "../cartStorage";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

const lines: CartLine[] = [
  { productId: "p-100", name: "Cotton Tee", unitPrice: 19.99, quantity: 2 },
  { productId: "p-205", name: "Canvas Tote", unitPrice: 12.5, quantity: 1 },
];

describe("cartStorage", () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("round-trips lines through storage", () => {
    saveCart(lines, storage);
    expect(loadCart(storage)).toEqual(lines);
  });

  it("returns [] for a missing key", () => {
    expect(loadCart(storage)).toEqual([]);
  });

  it("returns [] for a garbage string", () => {
    storage.setItem(CART_STORAGE_KEY, "{not json");
    expect(loadCart(storage)).toEqual([]);
  });

  it("returns [] for a JSON object instead of an array", () => {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ lines }));
    expect(loadCart(storage)).toEqual([]);
  });

  const badEntries: [string, unknown][] = [
    ["empty id", { ...lines[0], productId: "" }],
    ["zero quantity", { ...lines[0], quantity: 0 }],
    ["non-number price", { ...lines[0], unitPrice: "1e999" }],
    ["missing name", { productId: "p-1", unitPrice: 1, quantity: 1 }],
    ["null entry", null],
  ];
  it.each(badEntries)("rejects the whole payload when an entry has %s", (_label, bad) => {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([lines[0], bad]));
    expect(loadCart(storage)).toEqual([]);
  });

  it("returns [] when getItem throws", () => {
    const throwing = new MemoryStorage();
    throwing.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(() => loadCart(throwing)).not.toThrow();
    expect(loadCart(throwing)).toEqual([]);
  });

  it("does not throw when setItem throws", () => {
    const full = new MemoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveCart(lines, full)).not.toThrow();
  });

  it("uses globalThis.localStorage by default", () => {
    localStorage.clear();
    saveCart(lines);
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
    expect(loadCart()).toEqual(lines);
    localStorage.clear();
  });
});

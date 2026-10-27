import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

const CHEAP_MUG: SearchHit = {
  productId: "p-1",
  title: "Cheap Mug",
  url: "/p/1",
  unitPrice: 5,
};
const MID_LAMP: SearchHit = {
  productId: "p-2",
  title: "Mid Lamp",
  url: "/p/2",
  unitPrice: 40,
};

// Every value passed to a setter returned by the mocked useState below. React
// 18 drops a state update on an unmounted component without a warning, so this
// list is how a test sees whether one was attempted.
const { stateSetterCalls } = vi.hoisted(() => ({
  stateSetterCalls: [] as unknown[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const [value, setValue] = actual.useState(initial);
      const recordingSetter = (next: unknown) => {
        stateSetterCalls.push(next);
        setValue(next);
      };
      return [value, recordingSetter];
    }) as typeof actual.useState,
  };
});

type FakeResponse = { ok: boolean; json: () => Promise<{ hits: SearchHit[] }> };

// One entry per fetch call: the URL it was called with and a way to settle
// that call's response whenever the test chooses.
interface PendingFetch {
  url: string;
  respond: (hits: SearchHit[]) => void;
}

let pending: PendingFetch[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stateSetterCalls.length = 0;
  pending = [];
  fetchMock = vi.fn((url: string) => {
    return new Promise<FakeResponse>((resolve) => {
      pending.push({
        url,
        respond: (hits) => resolve({ ok: true, json: async () => ({ hits }) }),
      });
    });
  });
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Let the chained fetch -> json -> setHits promise callbacks run.
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

function pendingFor(url: string): PendingFetch {
  const entry = pending.find((p) => p.url === url);
  if (!entry) throw new Error(`no fetch issued for ${url}`);
  return entry;
}

function linkTexts(): string[] {
  return screen.getAllByRole("link").map((el) => el.textContent ?? "");
}

describe("SearchBox", () => {
  // Two debounced queries, "mug" then "mug lamp"; the newer response settles
  // first and the older one settles last.
  it("shows only the latest query's results when responses arrive out of order", async () => {
    render(<SearchBox />);

    typeQuery("mug");
    typeQuery("mug lamp");

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/search?q=mug",
      "/api/search?q=mug%20lamp",
    ]);

    pendingFor("/api/search?q=mug%20lamp").respond([MID_LAMP]);
    await flush();
    pendingFor("/api/search?q=mug").respond([CHEAP_MUG]);
    await flush();

    expect(linkTexts()).toEqual(["Mid Lamp"]);
  });

  // A "mug" request is still in flight when the component unmounts; its
  // response settles afterwards.
  it("does not throw when a response lands after unmount", async () => {
    const { unmount } = render(<SearchBox />);

    typeQuery("mug");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stateSetterCalls.includes("mug")).toBe(true);

    unmount();
    stateSetterCalls.length = 0;
    pendingFor("/api/search?q=mug").respond([CHEAP_MUG]);
    await expect(flush()).resolves.toBeUndefined();
    expect(stateSetterCalls).toEqual([]);
  });
});

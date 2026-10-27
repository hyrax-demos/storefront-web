import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { SearchBox } from "../SearchBox";
import type { SearchHit } from "../../types";

// React 18 silently ignores a state update on an unmounted component, so the
// only way to see whether SearchBox still calls setHits after unmount is to
// record the values passed to every useState setter. The wrapper forwards each
// call to the real setter, so rendering behaves as with the real useState.
const stateUpdates = vi.hoisted(() => [] as unknown[]);
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  function useState(initial?: unknown) {
    const [value, setValue] = actual.useState(initial);
    const recordingSetValue: typeof setValue = (next) => {
      stateUpdates.push(next);
      setValue(next);
    };
    return [value, recordingSetValue];
  }
  return { ...actual, useState };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

type FetchResponse = { json: () => Promise<{ hits: SearchHit[] }> };

// Stubs the global fetch so each request stays pending until the test resolves
// it by URL, which lets a test choose the order responses arrive in.
function stubFetch() {
  const pending = new Map<string, (res: FetchResponse) => void>();
  const fetchMock = vi.fn(
    (url: string) =>
      new Promise<FetchResponse>((resolve) => {
        pending.set(url, resolve);
      }),
  );
  vi.stubGlobal("fetch", fetchMock);

  async function respond(url: string, hits: SearchHit[]) {
    const resolve = pending.get(url);
    if (!resolve) throw new Error(`no pending request for ${url}`);
    await act(async () => {
      resolve({ json: async () => ({ hits }) });
      // Let the fetch -> json -> .then chain finish inside this act scope.
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
  }

  return { fetchMock, respond };
}

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search products"), {
    target: { value },
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function shownTitles(): (string | null)[] {
  return screen.queryAllByRole("link").map((a) => a.textContent);
}

describe("SearchBox", () => {
  it("keeps the newer query's results when the older response lands last", async () => {
    // Input: "mug" then "mug lamp", each past the debounce, with the
    // "mug lamp" response arriving before the "mug" one.
    vi.useFakeTimers();
    const { fetchMock, respond } = stubFetch();
    render(<SearchBox />);

    type("mug");
    advance(300);
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=mug");

    type("mug lamp");
    advance(300);
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=mug%20lamp");

    await respond("/api/search?q=mug%20lamp", [MID_LAMP]);
    await respond("/api/search?q=mug", [CHEAP_MUG]);

    expect(shownTitles()).toEqual(["Mid Lamp"]);
  });

  it("drops an in-flight response after the input is cleared", async () => {
    // Input: "mug" past the debounce, then an empty value before the "mug"
    // response arrives.
    vi.useFakeTimers();
    const { respond } = stubFetch();
    render(<SearchBox />);

    type("mug");
    advance(300);
    type("");
    await respond("/api/search?q=mug", [CHEAP_MUG]);

    expect(shownTitles()).toEqual([]);
  });

  it("does not set state when a response lands after unmount", async () => {
    // Input: "mug" past the debounce, then unmount before the "mug" response
    // arrives.
    vi.useFakeTimers();
    const { fetchMock, respond } = stubFetch();
    const { unmount } = render(<SearchBox />);

    type("mug");
    advance(300);
    unmount();
    stateUpdates.length = 0;

    await respond("/api/search?q=mug", [CHEAP_MUG]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stateUpdates).toEqual([]);
  });

  it("waits for the debounce before searching", () => {
    vi.useFakeTimers();
    const { fetchMock } = stubFetch();
    render(<SearchBox />);

    type("mug");
    advance(200);
    expect(fetchMock).not.toHaveBeenCalled();

    advance(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

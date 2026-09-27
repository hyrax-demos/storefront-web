import { useEffect, useRef, useState } from "react";
import { SearchResults } from "./SearchResults";
import type { SearchHit } from "../types";

async function searchProducts(
  query: string,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
  const data = (await res.json()) as { hits: SearchHit[] };
  return data.hits;
}

const DEBOUNCE_MS = 250;

// Type-ahead product search. Debounces keystrokes so we only hit the search
// API once the user pauses typing.
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Monotonically increasing id of the most recently issued request. A
  // response is only applied if it still matches this id when it resolves,
  // so a slow/reordered response for an older query can never clobber the
  // results of a newer one.
  const latestRequestId = useRef(0);
  // Lets us cancel the in-flight fetch for a query that's no longer current,
  // instead of merely ignoring its result once it arrives.
  const abortController = useRef<AbortController>();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (abortController.current) abortController.current.abort();
    if (query.trim() === "") {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      const requestId = ++latestRequestId.current;
      const controller = new AbortController();
      abortController.current = controller;
      searchProducts(query, controller.signal)
        .then((results) => {
          // Ignore responses for a query that's no longer the latest one
          // in flight — an older request that resolves after a newer one
          // must never overwrite the newer (or already-displayed) results.
          if (requestId !== latestRequestId.current) return;
          setHits(results);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          throw err;
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (abortController.current) abortController.current.abort();
    };
  }, [query]);

  return (
    <div className="search">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products"
      />
      <SearchResults results={hits} />
    </div>
  );
}

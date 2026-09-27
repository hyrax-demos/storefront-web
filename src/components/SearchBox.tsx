import { useEffect, useState } from "react";
import { SearchResults } from "./SearchResults";
import type { SearchHit } from "../types";

async function searchProducts(
  query: string,
  signal?: AbortSignal,
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
//
// Each effect run owns its own debounce timer and request. When the query
// changes (or the component unmounts) React runs the previous run's cleanup
// *before* starting the next one, which cancels the pending timer, aborts the
// in-flight request and marks the run as stale. A response can therefore only
// be applied while it belongs to the most recently issued query; a slower,
// older response can never overwrite newer results.
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (query.trim() === "") {
      setHits([]);
      return;
    }

    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchProducts(query, controller.signal).then(
        (results) => {
          if (current) setHits(results);
        },
        (err: unknown) => {
          // Superseded/aborted requests are expected; ignore them.
          if (!current || controller.signal.aborted) return;
          throw err;
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
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

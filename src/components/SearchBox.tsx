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
// changes (or the component unmounts) the cleanup clears the timer, aborts the
// in-flight fetch and marks the run as stale, so a response for an older query
// can never overwrite the results of a newer one, even if the network delivers
// it later.
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (query.trim() === "") {
      setHits([]);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      searchProducts(query, controller.signal).then(
        (results) => {
          if (active) setHits(results);
        },
        (err: unknown) => {
          // Rejections from a superseded (aborted) request are expected.
          if (!active) return;
          throw err;
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      active = false;
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

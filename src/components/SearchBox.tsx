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
// Each effect run owns the request it issues: when the query changes (or the
// component unmounts) the cleanup cancels the pending timer, aborts the
// in-flight fetch and marks the run as stale, so a response for a superseded
// query can never overwrite the results of a newer one.
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
          // Aborted/superseded requests are expected; ignore them.
          if (!active) return;
          console.error("search failed", err);
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

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
// Each effect run owns exactly one (debounced) request. When the query changes
// or the component unmounts, React runs the cleanup for the previous run, which
// cancels its timer, aborts its in-flight fetch and marks it stale — so a
// response for a superseded query can never overwrite newer results, no matter
// what order the network delivers responses in.
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
          // Aborted / superseded requests are expected; ignore them.
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

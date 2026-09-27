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
// Each effect run owns its own debounce timer and in-flight request. When the
// query changes (or the component unmounts) React runs the previous run's
// cleanup first, which clears its timer, aborts its fetch and marks it stale.
// A stale run can therefore never call setHits, so a response for an older
// query that resolves after a newer one is ignored instead of overwriting the
// results currently on screen.
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (query.trim() === "") {
      setHits([]);
      return;
    }

    let stale = false;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      searchProducts(query, controller.signal).then(
        (results) => {
          if (!stale) setHits(results);
        },
        (err: unknown) => {
          // Aborted or superseded requests are expected; drop them silently.
          if (stale) return;
          throw err;
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
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

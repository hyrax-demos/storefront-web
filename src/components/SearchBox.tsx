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
// or the component unmounts, the effect cleanup cancels the pending timer,
// aborts the in-flight request and marks it stale, so a response for a
// superseded query can never overwrite the results of a newer one — even if
// the network delivers the responses out of order.
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (query.trim() === "") {
      setHits([]);
      return;
    }

    const controller = new AbortController();
    let stale = false;

    const timer = setTimeout(() => {
      searchProducts(query, controller.signal).then(
        (results) => {
          if (!stale) setHits(results);
        },
        (err: unknown) => {
          // A superseded request being aborted is expected; anything else
          // for the current request is a real failure.
          if (stale || controller.signal.aborted) return;
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

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
// Each run of the effect below owns exactly one (debounced) request. When the
// query changes, the effect cleanup cancels the pending timer, aborts the
// in-flight request, and marks that run as stale, so a response for an older
// query can never overwrite the results of a newer one — even if the network
// delivers it later.
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
          // A superseded request was cancelled on purpose; nothing to report.
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

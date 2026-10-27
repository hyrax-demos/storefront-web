import { useEffect, useRef, useState } from "react";
import { SearchResults } from "./SearchResults";
import type { SearchHit } from "../types";

async function searchProducts(query: string): Promise<SearchHit[]> {
  const res = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
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

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim() === "") {
      setHits([]);
      return;
    }
    // A response is applied only while its query is still the current one; a
    // newer query, clearing the input, or unmount runs this cleanup and drops it.
    let cancelled = false;
    timer.current = setTimeout(() => {
      searchProducts(query).then((results) => {
        if (!cancelled) setHits(results);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelled = true;
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

import { useMemo, useState } from "react";
import type { SearchHit } from "../types";

type SortKey = "relevance" | "priceAsc" | "priceDesc";

function sortHits(hits: SearchHit[], sort: SortKey): SearchHit[] {
  const copy = [...hits];
  if (sort === "priceAsc") copy.sort((a, b) => a.unitPrice - b.unitPrice);
  if (sort === "priceDesc") copy.sort((a, b) => b.unitPrice - a.unitPrice);
  return copy;
}

// One row of search results, with a local "save for later" toggle.
function ResultRow({ hit }: { hit: SearchHit }) {
  const [saved, setSaved] = useState(false);
  return (
    <li className="result">
      <a href={hit.url}>{hit.title}</a>
      <span className="price">${hit.unitPrice.toFixed(2)}</span>
      <button
        className={saved ? "saved" : ""}
        onClick={() => setSaved((s) => !s)}
      >
        {saved ? "Saved" : "Save for later"}
      </button>
    </li>
  );
}

export function SearchResults({ results }: { results: SearchHit[] }) {
  const [sort, setSort] = useState<SortKey>("relevance");
  const sorted = useMemo(() => sortHits(results, sort), [results, sort]);

  return (
    <div>
      <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
        <option value="relevance">Relevance</option>
        <option value="priceAsc">Price: low to high</option>
        <option value="priceDesc">Price: high to low</option>
      </select>
      <ul>
        {sorted.map((hit, i) => (
          <ResultRow key={i} hit={hit} />
        ))}
      </ul>
    </div>
  );
}

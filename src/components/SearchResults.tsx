interface Result {
  title: string;
  url: string;
  // Server-rendered snippet with the matched query wrapped in <mark> tags.
  highlightedSnippet: string;
}

export function SearchResults({ results }: { results: Result[] }) {
  return (
    <ul>
      {results.map((r, i) => (
        <li key={i}>
          <a href={r.url} target="_blank">
            {r.title}
          </a>
          <p
            className="snippet"
            dangerouslySetInnerHTML={{ __html: r.highlightedSnippet }}
          />
        </li>
      ))}
    </ul>
  );
}

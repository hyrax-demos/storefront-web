interface Result {
  title: string;
  url: string;
}

export function SearchResults({ results }: { results: Result[] }) {
  return (
    <ul>
      {results.map((r, i) => (
        <li key={i}>
          <a href={r.url}>{r.title}</a>
        </li>
      ))}
    </ul>
  );
}

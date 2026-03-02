import type { Fragrance } from "../types/fragrance";

interface FragranceCardProps {
  fragrance: Fragrance | null;
}

export default function FragranceCard({ fragrance }: FragranceCardProps) {
  if (!fragrance) {
    return (
      <article className="ring-card" aria-live="polite">
        <p className="ring-card-empty">Choose a city to view its exclusive fragrance.</p>
      </article>
    );
  }

  return (
    <article className="ring-card" aria-live="polite">
      <p className="ring-card-city">{fragrance.city}</p>
      <p className="ring-card-fragrance">{fragrance.name}</p>
      <p className="ring-card-country">{fragrance.country}</p>
      {fragrance.tagline && <p className="ring-card-tagline">{fragrance.tagline}</p>}
      {fragrance.notes && fragrance.notes.length > 0 && (
        <p className="ring-card-notes">{fragrance.notes.join(" · ")}</p>
      )}
      {fragrance.url && (
        <a
          className="ring-card-link"
          href={fragrance.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Le Labo &rarr;
        </a>
      )}
    </article>
  );
}

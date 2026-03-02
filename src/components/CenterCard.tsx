import type { Fragrance } from "../types/fragrance";

interface CenterCardProps {
  fragrance: Fragrance | null;
}

export default function CenterCard({ fragrance }: CenterCardProps) {
  if (!fragrance) {
    return (
      <article className="dial-center-card" aria-live="polite">
        <p className="dial-center-empty">Select a city to explore</p>
      </article>
    );
  }

  return (
    <article className="dial-center-card" aria-live="polite">
      <p className="dial-center-name">{fragrance.name}</p>
      {fragrance.tagline && (
        <p className="dial-center-tagline">{fragrance.tagline}</p>
      )}
      {fragrance.notes && fragrance.notes.length > 0 && (
        <p className="dial-center-notes">{fragrance.notes.join(" · ")}</p>
      )}
      <p className="dial-center-city">{fragrance.city}</p>
      <p className="dial-center-country">{fragrance.country}</p>
      <a
        className="dial-center-link"
        href={fragrance.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Le Labo &rarr;
      </a>
    </article>
  );
}

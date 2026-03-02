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
      <p className="dial-center-city">{fragrance.city}</p>
      <p className="dial-center-country">{fragrance.country}</p>
    </article>
  );
}

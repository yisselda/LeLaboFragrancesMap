import { memo, type CSSProperties } from "react";
import type { Fragrance } from "../types/fragrance";

interface CityPillProps {
  fragrance: Fragrance;
  x: number;
  y: number;
  selected: boolean;
  matched: boolean;
  visualOpacity: number;
  onSelect: (fragrance: Fragrance) => void;
  suppressClick: boolean;
}

function CityPill({
  fragrance,
  x,
  y,
  selected,
  matched,
  visualOpacity,
  onSelect,
  suppressClick,
}: CityPillProps) {
  const style = {
    left: `${x}px`,
    top: `${y}px`,
    "--pill-opacity": visualOpacity,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`city-pill ${selected ? "selected" : ""} ${
        matched ? "matched" : ""
      }`}
      data-fragrance-name={fragrance.name}
      style={style}
      onClick={() => {
        if (!suppressClick) {
          onSelect(fragrance);
        }
      }}
      aria-label={`${fragrance.city} — City Exclusive: ${fragrance.name}, ${fragrance.country}`}
      aria-pressed={selected}
    >
      <span className="city-pill-label">{fragrance.city}</span>
    </button>
  );
}

export default memo(CityPill);

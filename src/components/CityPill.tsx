import { memo } from "react";
import type { Fragrance } from "../types/fragrance";

interface CityPillProps {
  fragrance: Fragrance;
  x: number;
  y: number;
  selected: boolean;
  dimmed: boolean;
  matched: boolean;
  onSelect: (fragrance: Fragrance) => void;
  suppressClick: boolean;
}

function CityPill({
  fragrance,
  x,
  y,
  selected,
  dimmed,
  matched,
  onSelect,
  suppressClick,
}: CityPillProps) {
  return (
    <button
      type="button"
      className={`city-pill ${selected ? "selected" : ""} ${
        dimmed ? "dimmed" : ""
      } ${matched ? "matched" : ""}`}
      style={{ left: `${x}px`, top: `${y}px` }}
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

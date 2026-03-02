import { forwardRef, memo } from "react";
import type { Fragrance } from "../types/fragrance";

interface CityChipProps {
  fragrance: Fragrance;
  selected: boolean;
  onSelect: (fragrance: Fragrance) => void;
  compact?: boolean;
}

const CityChip = forwardRef<HTMLButtonElement, CityChipProps>(function CityChip(
  { fragrance, selected, onSelect, compact = false },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ring-chip ${compact ? "compact" : ""} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-label={`${fragrance.city} — City Exclusive: ${fragrance.name}, ${fragrance.country}`}
      onClick={() => onSelect(fragrance)}
      data-city={fragrance.city}
    >
      {fragrance.city}
    </button>
  );
});

export default memo(CityChip);

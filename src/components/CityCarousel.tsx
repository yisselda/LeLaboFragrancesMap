import { useCallback, useEffect, useRef } from "react";
import type { Fragrance } from "../types/fragrance";
import CityChip from "./CityChip";

interface CityCarouselProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
  onSelectFragrance: (fragrance: Fragrance) => void;
}

export default function CityCarousel({
  fragrances,
  selectedFragrance,
  onSelectFragrance,
}: CityCarouselProps) {
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectedCity = selectedFragrance?.city ?? null;

  const centerChip = useCallback((city: string) => {
    const chip = chipRefs.current[city];
    if (!chip) {
      return;
    }

    chip.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, []);

  useEffect(() => {
    if (selectedCity) {
      centerChip(selectedCity);
    }
  }, [centerChip, selectedCity]);

  const selectByStep = useCallback(
    (step: number) => {
      if (fragrances.length === 0) {
        return;
      }

      const currentIndex = selectedCity
        ? fragrances.findIndex((fragrance) => fragrance.city === selectedCity)
        : 0;

      const nextIndex =
        (Math.max(currentIndex, 0) + step + fragrances.length) % fragrances.length;
      const nextFragrance = fragrances[nextIndex];
      if (!nextFragrance) {
        return;
      }

      onSelectFragrance(nextFragrance);
      requestAnimationFrame(() => {
        chipRefs.current[nextFragrance.city]?.focus();
      });
    },
    [fragrances, onSelectFragrance, selectedCity]
  );

  return (
    <div className="ring-chip-row-shell">
      <div
        className="ring-chip-row"
        role="group"
        aria-label="City selector"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            selectByStep(1);
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectByStep(-1);
          }

          if (event.key === "Enter" && selectedCity) {
            event.preventDefault();
            const selected = fragrances.find((fragrance) => fragrance.city === selectedCity);
            if (selected) {
              onSelectFragrance(selected);
              centerChip(selected.city);
            }
          }
        }}
      >
        {fragrances.map((fragrance) => (
          <div className="ring-chip-wrap compact" key={fragrance.name}>
            <CityChip
              fragrance={fragrance}
              selected={selectedCity === fragrance.city}
              onSelect={onSelectFragrance}
              compact
              ref={(element) => {
                chipRefs.current[fragrance.city] = element;
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

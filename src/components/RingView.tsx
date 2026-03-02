import { useEffect, useMemo, useState } from "react";
import type { Fragrance } from "../types/fragrance";
import CityCarousel from "./CityCarousel";
import RingCoverCarousel from "./RingCoverCarousel";
import SearchInput from "./SearchInput";

interface RingViewProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
  onSelectFragrance: (fragrance: Fragrance) => void;
}

function rankMatch(fragrance: Fragrance, term: string): number {
  const city = fragrance.city.toLowerCase();
  const name = fragrance.name.toLowerCase();
  const country = fragrance.country.toLowerCase();

  if (city === term) return 0;
  if (city.startsWith(term)) return 1;
  if (city.includes(term)) return 2;
  if (name === term) return 3;
  if (name.startsWith(term)) return 4;
  if (name.includes(term)) return 5;
  if (country === term) return 6;
  if (country.startsWith(term)) return 7;
  if (country.includes(term)) return 8;
  return Number.POSITIVE_INFINITY;
}

export default function RingView({
  fragrances,
  selectedFragrance,
  onSelectFragrance,
}: RingViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const orderedFragrances = useMemo(
    () =>
      [...fragrances].sort(
        (first, second) =>
          first.city.localeCompare(second.city) ||
          first.name.localeCompare(second.name)
      ),
    [fragrances]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredFragrances = useMemo(() => {
    if (!normalizedSearch) {
      return orderedFragrances;
    }

    return orderedFragrances.filter(
      (fragrance) =>
        fragrance.city.toLowerCase().includes(normalizedSearch) ||
        fragrance.name.toLowerCase().includes(normalizedSearch) ||
        fragrance.country.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, orderedFragrances]);

  const topMatch = useMemo(() => {
    if (!normalizedSearch) {
      return filteredFragrances[0] ?? null;
    }

    const ranked = orderedFragrances
      .map((fragrance) => ({
        fragrance,
        score: rankMatch(fragrance, normalizedSearch),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort(
        (first, second) =>
          first.score - second.score ||
          first.fragrance.city.localeCompare(second.fragrance.city)
      );

    return ranked[0]?.fragrance ?? null;
  }, [filteredFragrances, normalizedSearch, orderedFragrances]);

  const selectedIndex = useMemo(
    () =>
      filteredFragrances.findIndex(
        (fragrance) => fragrance.city === selectedFragrance?.city
      ),
    [filteredFragrances, selectedFragrance?.city]
  );

  useEffect(() => {
    if (filteredFragrances.length === 0 || selectedIndex !== -1) {
      return;
    }

    onSelectFragrance(filteredFragrances[0]);
  }, [filteredFragrances, onSelectFragrance, selectedIndex]);

  return (
    <section className="ring-view">
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        onEnter={() => {
          if (topMatch) {
            onSelectFragrance(topMatch);
          }
        }}
      />

      {filteredFragrances.length === 0 ? (
        <div className="ring-empty-state">No matches.</div>
      ) : (
        <>
          <CityCarousel
            fragrances={filteredFragrances}
            selectedFragrance={selectedFragrance}
            onSelectFragrance={onSelectFragrance}
          />
          <RingCoverCarousel
            fragrances={filteredFragrances}
            selectedIndex={Math.max(selectedIndex, 0)}
            onSelectIndex={(index) => {
              const nextFragrance = filteredFragrances[index];
              if (nextFragrance) {
                onSelectFragrance(nextFragrance);
              }
            }}
          />
        </>
      )}
    </section>
  );
}

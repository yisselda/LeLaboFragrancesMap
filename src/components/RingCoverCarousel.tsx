import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Fragrance } from "../types/fragrance";

interface RingCoverCarouselProps {
  fragrances: Fragrance[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

interface CoverCard {
  key: string;
  fragrance: Fragrance;
  kind: "prev" | "current" | "next";
  absoluteIndex: number;
}

const HINT_STORAGE_KEY = "ring-cover-hint-dismissed";

function modIndex(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value + total) % total;
}

export default function RingCoverCarousel({
  fragrances,
  selectedIndex,
  onSelectIndex,
}: RingCoverCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const settleTimerRef = useRef<number | null>(null);
  const [showHint, setShowHint] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return localStorage.getItem(HINT_STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const total = fragrances.length;
  const safeSelectedIndex = modIndex(selectedIndex, total);
  const prevIndex = modIndex(safeSelectedIndex - 1, total);
  const nextIndex = modIndex(safeSelectedIndex + 1, total);

  const cards = useMemo<CoverCard[]>(() => {
    if (total === 0) {
      return [];
    }

    if (total === 1) {
      const current = fragrances[safeSelectedIndex];
      return [
        {
          key: `current-${current.city}`,
          fragrance: current,
          kind: "current",
          absoluteIndex: safeSelectedIndex,
        },
      ];
    }

    return [
      {
        key: `prev-${fragrances[prevIndex].city}`,
        fragrance: fragrances[prevIndex],
        kind: "prev",
        absoluteIndex: prevIndex,
      },
      {
        key: `current-${fragrances[safeSelectedIndex].city}`,
        fragrance: fragrances[safeSelectedIndex],
        kind: "current",
        absoluteIndex: safeSelectedIndex,
      },
      {
        key: `next-${fragrances[nextIndex].city}`,
        fragrance: fragrances[nextIndex],
        kind: "next",
        absoluteIndex: nextIndex,
      },
    ];
  }, [fragrances, nextIndex, prevIndex, safeSelectedIndex, total]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  useEffect(() => {
    if (cards.length === 0 || !viewportRef.current) {
      return;
    }

    const centerIndex = cards.findIndex((card) => card.kind === "current");
    const centerCard = cardRefs.current[centerIndex];
    centerCard?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [cards]);

  const settleSelection = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || cards.length < 2) {
      return;
    }

    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        return;
      }

      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < smallestDistance) {
        nearest = index;
        smallestDistance = distance;
      }
    });

    if (cards[nearest] && cards[nearest].kind !== "current") {
      onSelectIndex(cards[nearest].absoluteIndex);
    }
  }, [cards, onSelectIndex]);

  const scheduleSettle = useCallback(() => {
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      settleSelection();
    }, 90);
  }, [settleSelection]);

  useEffect(
    () => () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    []
  );

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="ring-cover" aria-label="City fragrance carousel">
      <button
        type="button"
        className="ring-cover-nav ring-cover-nav-prev"
        onClick={() => {
          dismissHint();
          onSelectIndex(prevIndex);
        }}
        aria-label="Previous city"
      >
        &lsaquo;
      </button>

      <div
        className="ring-cover-viewport"
        ref={viewportRef}
        tabIndex={0}
        aria-label="Swipe left or right to change city"
        onScroll={scheduleSettle}
        onPointerDown={dismissHint}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            dismissHint();
            onSelectIndex(prevIndex);
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            dismissHint();
            onSelectIndex(nextIndex);
          }
        }}
      >
        <div className="ring-cover-track">
          {cards.map((card, index) => {
            const sideCard = card.kind !== "current";
            return (
              <article
                key={card.key}
                ref={(element) => {
                  cardRefs.current[index] = element;
                }}
                className={`ring-cover-card ${card.kind}`}
                onClick={() => {
                  dismissHint();
                  if (sideCard) {
                    onSelectIndex(card.absoluteIndex);
                  }
                }}
                aria-live={card.kind === "current" ? "polite" : undefined}
              >
                <p className="ring-cover-city">{card.fragrance.city}</p>
                <p className="ring-cover-fragrance">{card.fragrance.name}</p>
                <p className="ring-cover-country">{card.fragrance.country}</p>
                {card.kind === "current" && card.fragrance.tagline && (
                  <p className="ring-cover-tagline">{card.fragrance.tagline}</p>
                )}
                {card.kind === "current" &&
                  card.fragrance.notes &&
                  card.fragrance.notes.length > 0 && (
                    <p className="ring-cover-notes">
                      {card.fragrance.notes.join(" · ")}
                    </p>
                  )}
                {card.kind === "current" && card.fragrance.url && (
                  <a
                    className="ring-cover-link"
                    href={card.fragrance.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    View on Le Labo &rarr;
                  </a>
                )}
                {card.kind === "current" && (
                  <p className="ring-cover-meta">
                    {card.fragrance.city} — {safeSelectedIndex + 1} / {total}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="ring-cover-nav ring-cover-nav-next"
        onClick={() => {
          dismissHint();
          onSelectIndex(nextIndex);
        }}
        aria-label="Next city"
      >
        &rsaquo;
      </button>

      {showHint && (
        <button type="button" className="ring-cover-hint" onClick={dismissHint}>
          Swipe
        </button>
      )}

      <div className="ring-cover-dots" aria-hidden="true">
        {fragrances.map((fragrance, index) => (
          <span
            key={fragrance.city}
            className={`ring-cover-dot ${index === safeSelectedIndex ? "active" : ""}`}
          />
        ))}
      </div>
    </section>
  );
}

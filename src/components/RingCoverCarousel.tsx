import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const dragReleaseTimerRef = useRef<number | null>(null);
  const scrollDragTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    handled: boolean;
  } | null>(null);
  const suppressCardClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const markSwipeHandled = useCallback(() => {
    suppressCardClickRef.current = true;

    if (suppressClickTimerRef.current) {
      window.clearTimeout(suppressClickTimerRef.current);
    }

    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressCardClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 180);
  }, []);

  const beginDragState = useCallback(() => {
    if (dragReleaseTimerRef.current) {
      window.clearTimeout(dragReleaseTimerRef.current);
      dragReleaseTimerRef.current = null;
    }
    if (scrollDragTimerRef.current) {
      window.clearTimeout(scrollDragTimerRef.current);
      scrollDragTimerRef.current = null;
    }
    setIsDragging(true);
  }, []);

  const endDragStateSoon = useCallback((delay = 120) => {
    if (dragReleaseTimerRef.current) {
      window.clearTimeout(dragReleaseTimerRef.current);
    }

    dragReleaseTimerRef.current = window.setTimeout(() => {
      setIsDragging(false);
      dragReleaseTimerRef.current = null;
    }, delay);
  }, []);

  const markScrollDragging = useCallback(() => {
    beginDragState();

    if (scrollDragTimerRef.current) {
      window.clearTimeout(scrollDragTimerRef.current);
    }

    scrollDragTimerRef.current = window.setTimeout(() => {
      setIsDragging(false);
      scrollDragTimerRef.current = null;
    }, 120);
  }, [beginDragState]);

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
      if (dragReleaseTimerRef.current) {
        window.clearTimeout(dragReleaseTimerRef.current);
      }
      if (scrollDragTimerRef.current) {
        window.clearTimeout(scrollDragTimerRef.current);
      }
      if (suppressClickTimerRef.current) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    },
    []
  );

  if (cards.length === 0) {
    return null;
  }

  const activeCardIndex = cards.findIndex((card) => card.kind === "current");
  return (
    <section className="ring-cover" aria-label="City fragrance carousel">
      <button
        type="button"
        className="ringNavBtn ringNavBtnPrev leftArrowIcon"
        aria-label="Previous city"
        onClick={() => {
          dismissHint();
          onSelectIndex(prevIndex);
        }}
      />
      <div
        className="ring-cover-viewport"
        ref={viewportRef}
        tabIndex={0}
        aria-label="Swipe left or right to change city"
        onScroll={() => {
          scheduleSettle();
          markScrollDragging();
        }}
        onPointerDown={(event) => {
          dismissHint();
          beginDragState();
          swipeStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            handled: false,
          };
        }}
        onPointerMove={(event) => {
          const start = swipeStartRef.current;
          if (!start || start.pointerId !== event.pointerId || start.handled) {
            return;
          }

          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;

          if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) {
            return;
          }

          start.handled = true;
          markSwipeHandled();

          if (dx < 0) {
            onSelectIndex(nextIndex);
          } else {
            onSelectIndex(prevIndex);
          }
        }}
        onPointerUp={(event) => {
          const start = swipeStartRef.current;
          if (!start || start.pointerId !== event.pointerId) {
            endDragStateSoon(120);
            return;
          }

          if (!start.handled) {
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;

            if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) {
              markSwipeHandled();
              if (dx < 0) {
                onSelectIndex(nextIndex);
              } else {
                onSelectIndex(prevIndex);
              }
            }
          }

          swipeStartRef.current = null;
          endDragStateSoon(120);
        }}
        onPointerCancel={() => {
          swipeStartRef.current = null;
          endDragStateSoon(120);
        }}
        onTouchStart={() => {
          dismissHint();
          beginDragState();
        }}
        onTouchEnd={() => {
          endDragStateSoon(120);
        }}
        onTouchCancel={() => {
          endDragStateSoon(120);
        }}
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
        <div className={`ring-cover-track${isDragging ? " is-dragging" : ""}`}>
          {cards.map((card, index) => {
            const sideCard = card.kind !== "current";
            const isActive = index === activeCardIndex;
            return (
              <article
                key={card.key}
                ref={(element) => {
                  cardRefs.current[index] = element;
                }}
                className={`ring-cover-card ${card.kind}`}
                data-active={isActive ? "true" : "false"}
                data-slide-index={index}
                onClick={() => {
                  if (suppressCardClickRef.current) {
                    return;
                  }
                  dismissHint();
                  if (sideCard) {
                    onSelectIndex(card.absoluteIndex);
                  }
                }}
                aria-live={card.kind === "current" ? "polite" : undefined}
              >
                <div className="ring-cover-column">
                  <div className="ring-cover-top">
                    <p className="ring-cover-fragrance">{card.fragrance.name}</p>
                    <p className="ring-cover-city">{card.fragrance.city}</p>
                  </div>

                  <div className="ring-cover-divider" aria-hidden="true" />

                  <div className="ring-cover-body">
                    <p className="ring-cover-country">{card.fragrance.country}</p>
                    {card.kind === "current" && card.fragrance.description && (
                      <p className="ring-cover-description">
                        {card.fragrance.description}
                      </p>
                    )}
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
                  </div>

                  {card.kind === "current" && (
                    <div className="ring-cover-footer">
                      {card.fragrance.url && (
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
                      <p className="ring-cover-meta">
                        {card.fragrance.city} — {safeSelectedIndex + 1} / {total}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="ringNavBtn ringNavBtnNext rightArrowIcon"
        aria-label="Next city"
        onClick={() => {
          dismissHint();
          onSelectIndex(nextIndex);
        }}
      />

      {showHint && (
        <button type="button" className="ring-cover-hint" onClick={dismissHint}>
          Swipe
        </button>
      )}
    </section>
  );
}

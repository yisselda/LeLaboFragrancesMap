import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Fragrance } from "../types/fragrance";
import CenterCard from "./CenterCard";
import CityPill from "./CityPill";
import SearchBox from "./SearchBox";

interface SqrViewProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
  onSelectFragrance: (fragrance: Fragrance) => void;
}

interface SqrNode {
  fragrance: Fragrance;
  basePosition: number;
  ring: "outer" | "inner";
}

interface StageBounds {
  width: number;
  height: number;
}

interface ElementSize {
  width: number;
  height: number;
}

const TAU = Math.PI * 2;
const ANCHOR_POSITION = 0;
const OUTER_RING_COUNT = 14;
const HINT_DISMISS_KEY = "le-labo-sqr-hint-dismissed";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeOffset(offset: number): number {
  const normalized = offset % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

function normalizeOffsetDelta(delta: number): number {
  return ((((delta + 0.5) % 1) + 1) % 1) - 0.5;
}

function easeInOutQuad(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fitDimension(min: number, preferred: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  if (min > max) {
    return max;
  }

  return clamp(preferred, min, max);
}

function pointOnRectPath(
  progress: number,
  halfWidth: number,
  halfHeight: number,
  centerX: number,
  centerY: number
) {
  const normalized = normalizeOffset(progress);
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  const perimeter = 2 * (width + height);

  let distance = normalized * perimeter;
  const topHalf = width / 2;

  if (distance <= topHalf) {
    return {
      x: centerX + distance,
      y: centerY - halfHeight,
    };
  }
  distance -= topHalf;

  if (distance <= height) {
    return {
      x: centerX + halfWidth,
      y: centerY - halfHeight + distance,
    };
  }
  distance -= height;

  if (distance <= width) {
    return {
      x: centerX + halfWidth - distance,
      y: centerY + halfHeight,
    };
  }
  distance -= width;

  if (distance <= height) {
    return {
      x: centerX - halfWidth,
      y: centerY + halfHeight - distance,
    };
  }
  distance -= height;

  return {
    x: centerX - halfWidth + distance,
    y: centerY - halfHeight,
  };
}

export default function SqrView({
  fragrances,
  selectedFragrance,
  onSelectFragrance,
}: SqrViewProps) {
  const orderedFragrances = useMemo(
    () =>
      [...fragrances].sort(
        (first, second) =>
          first.city.localeCompare(second.city) ||
          first.name.localeCompare(second.name)
      ),
    [fragrances]
  );

  const nodes = useMemo<SqrNode[]>(() => {
    const outerCount = Math.min(OUTER_RING_COUNT, orderedFragrances.length);
    const innerCount = Math.max(orderedFragrances.length - outerCount, 0);

    const outerStep = outerCount > 0 ? 1 / outerCount : 0;
    const innerStep = innerCount > 0 ? 1 / innerCount : 0;
    const innerOffset = innerCount > 0 ? innerStep / 2 : 0;

    return orderedFragrances.map((fragrance, index) => {
      if (index < outerCount) {
        return {
          fragrance,
          basePosition: index * outerStep,
          ring: "outer",
        };
      }

      const innerIndex = index - outerCount;
      return {
        fragrance,
        basePosition: innerIndex * innerStep + innerOffset,
        ring: "inner",
      };
    });
  }, [orderedFragrances]);

  const nodeByName = useMemo(
    () => new Map(nodes.map((node) => [node.fragrance.name, node])),
    [nodes]
  );

  const [pathOffset, setPathOffset] = useState(() => {
    if (!selectedFragrance) {
      return 0;
    }

    const selectedNode = nodeByName.get(selectedFragrance.name);
    if (!selectedNode) {
      return 0;
    }

    return normalizeOffset(ANCHOR_POSITION - selectedNode.basePosition);
  });
  const pathOffsetRef = useRef(pathOffset);

  const [stageBounds, setStageBounds] = useState<StageBounds>({
    width: 0,
    height: 0,
  });
  const [centerCardBounds, setCenterCardBounds] = useState<ElementSize>({
    width: 0,
    height: 0,
  });

  const animationFrameRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragOffsetRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const centerCardRef = useRef<HTMLElement | null>(null);

  const pointerIdRef = useRef<number | null>(null);
  const pointerDownFragranceNameRef = useRef<string | null>(null);
  const dragStartAngleRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const draggedRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [suppressClick, setSuppressClick] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showHint, setShowHint] = useState(() => {
    try {
      return localStorage.getItem(HINT_DISMISS_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const stageWidth = stageBounds.width || 920;
  const stageHeight = stageBounds.height || 700;
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;
  const isCompactStage = stageWidth <= 760;

  const cardHalfWidth =
    (centerCardBounds.width || (isCompactStage ? 250 : 360)) / 2;
  const cardHalfHeight =
    (centerCardBounds.height || (isCompactStage ? 180 : 210)) / 2;

  const pillHalfWidth = isCompactStage ? 58 : 66;
  const pillHalfHeight = 24;
  const edgePaddingX = pillHalfWidth + 10;
  const edgePaddingY = pillHalfHeight + 10;

  const maxHalfWidth = Math.max(120, stageWidth / 2 - edgePaddingX);
  const maxHalfHeight = Math.max(110, stageHeight / 2 - edgePaddingY);

  const minOuterHalfWidth = cardHalfWidth + pillHalfWidth + 20;
  const minOuterHalfHeight = cardHalfHeight + pillHalfHeight + 20;

  const outerHalfWidth = fitDimension(
    minOuterHalfWidth,
    maxHalfWidth * 0.97,
    maxHalfWidth
  );
  const outerHalfHeight = fitDimension(
    minOuterHalfHeight,
    maxHalfHeight * 0.95,
    maxHalfHeight
  );

  const minInnerHalfWidth = cardHalfWidth + pillHalfWidth + 6;
  const minInnerHalfHeight = cardHalfHeight + pillHalfHeight + 6;
  const innerMaxHalfWidth = Math.max(
    minInnerHalfWidth,
    outerHalfWidth - (isCompactStage ? 34 : 46)
  );
  const innerMaxHalfHeight = Math.max(
    minInnerHalfHeight,
    outerHalfHeight - (isCompactStage ? 30 : 40)
  );

  const innerHalfWidth = fitDimension(
    minInnerHalfWidth,
    outerHalfWidth - (isCompactStage ? 66 : 84),
    innerMaxHalfWidth
  );
  const innerHalfHeight = fitDimension(
    minInnerHalfHeight,
    outerHalfHeight - (isCompactStage ? 58 : 74),
    innerMaxHalfHeight
  );

  const selectedName = selectedFragrance?.name ?? null;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const sqrStyle = useMemo(
    () =>
      ({
        "--sqr-outer-width": `${outerHalfWidth * 2}px`,
        "--sqr-outer-height": `${outerHalfHeight * 2}px`,
        "--sqr-inner-width": `${innerHalfWidth * 2}px`,
        "--sqr-inner-height": `${innerHalfHeight * 2}px`,
      }) as CSSProperties,
    [innerHalfHeight, innerHalfWidth, outerHalfHeight, outerHalfWidth]
  );

  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const position = normalizeOffset(node.basePosition + pathOffset);
        const halfWidth = node.ring === "outer" ? outerHalfWidth : innerHalfWidth;
        const halfHeight =
          node.ring === "outer" ? outerHalfHeight : innerHalfHeight;
        const point = pointOnRectPath(
          position,
          halfWidth,
          halfHeight,
          centerX,
          centerY
        );

        return {
          ...node,
          position,
          x: point.x,
          y: point.y,
        };
      }),
    [centerX, centerY, innerHalfHeight, innerHalfWidth, nodes, outerHalfHeight, outerHalfWidth, pathOffset]
  );

  const matchingNameSet = useMemo(() => {
    if (!normalizedSearch) {
      return new Set<string>();
    }

    return new Set(
      orderedFragrances
        .filter((fragrance) => {
          const term = normalizedSearch;
          return (
            fragrance.name.toLowerCase().includes(term) ||
            fragrance.city.toLowerCase().includes(term) ||
            fragrance.country.toLowerCase().includes(term)
          );
        })
        .map((fragrance) => fragrance.name)
    );
  }, [normalizedSearch, orderedFragrances]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_DISMISS_KEY, "1");
    } catch {
      // Ignore storage failures in private mode.
    }
  }, []);

  const animateToOffset = useCallback((targetOffset: number) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const target = normalizeOffset(targetOffset);
    const start = pathOffsetRef.current;
    const delta = normalizeOffsetDelta(target - start);

    if (Math.abs(delta) < 0.0008) {
      pathOffsetRef.current = target;
      setPathOffset(target);
      return;
    }

    const duration = prefersReducedMotion() ? 0 : 300;
    if (duration === 0) {
      pathOffsetRef.current = target;
      setPathOffset(target);
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeInOutQuad(progress);
      const next = normalizeOffset(start + delta * easedProgress);

      pathOffsetRef.current = next;
      setPathOffset(next);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const getAnchorOffset = useCallback(
    (fragranceName: string): number | null => {
      const node = nodeByName.get(fragranceName);
      if (!node) {
        return null;
      }
      return normalizeOffset(ANCHOR_POSITION - node.basePosition);
    },
    [nodeByName]
  );

  const selectAndAnchor = useCallback(
    (fragrance: Fragrance, animate = true) => {
      const targetOffset = getAnchorOffset(fragrance.name);
      if (targetOffset === null) {
        return;
      }

      onSelectFragrance(fragrance);

      if (animate) {
        animateToOffset(targetOffset);
      } else {
        pathOffsetRef.current = targetOffset;
        setPathOffset(targetOffset);
      }

      dismissHint();
    },
    [animateToOffset, dismissHint, getAnchorOffset, onSelectFragrance]
  );

  const findBestMatch = useCallback(
    (rawTerm: string): Fragrance | null => {
      const term = rawTerm.trim().toLowerCase();
      if (!term) {
        return null;
      }

      const scored = orderedFragrances
        .map((fragrance) => {
          const name = fragrance.name.toLowerCase();
          const city = fragrance.city.toLowerCase();
          const country = fragrance.country.toLowerCase();

          let score = Number.POSITIVE_INFINITY;

          if (name === term || city === term || country === term) {
            score = 0;
          } else if (name.startsWith(term) || city.startsWith(term)) {
            score = 1;
          } else if (name.includes(term) || city.includes(term)) {
            score = 2;
          } else if (country.startsWith(term)) {
            score = 3;
          } else if (country.includes(term)) {
            score = 4;
          }

          return { fragrance, score };
        })
        .filter((item) => Number.isFinite(item.score))
        .sort(
          (first, second) =>
            first.score - second.score ||
            first.fragrance.city.localeCompare(second.fragrance.city)
        );

      return scored[0]?.fragrance ?? null;
    },
    [orderedFragrances]
  );

  const handleSearchSubmit = useCallback(() => {
    const match = findBestMatch(searchTerm);
    if (match) {
      selectAndAnchor(match, true);
    }
  }, [findBestMatch, searchTerm, selectAndAnchor]);

  const findNearestNode = useCallback(
    (currentOffset: number): SqrNode | null => {
      if (nodes.length === 0) {
        return null;
      }

      let nearest: SqrNode | null = null;
      let smallestDelta = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        const position = normalizeOffset(node.basePosition + currentOffset);
        const delta = Math.abs(
          normalizeOffsetDelta(ANCHOR_POSITION - position)
        );

        if (delta < smallestDelta) {
          smallestDelta = delta;
          nearest = node;
        }
      }

      return nearest;
    },
    [nodes]
  );

  const updateOffsetFromPointer = useCallback((nextOffset: number) => {
    pendingDragOffsetRef.current = normalizeOffset(nextOffset);

    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragOffsetRef.current;
      if (pending === null) {
        return;
      }

      pathOffsetRef.current = pending;
      setPathOffset(pending);
      pendingDragOffsetRef.current = null;
    });
  }, []);

  const getPointerAngle = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stage = stageRef.current;
      if (!stage) {
        return 0;
      }

      const bounds = stage.getBoundingClientRect();
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);

      return Math.atan2(dy, dx);
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest(".dial-center-card")) {
        return;
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      pointerIdRef.current = event.pointerId;
      pointerDownFragranceNameRef.current =
        target
          ?.closest<HTMLButtonElement>("[data-fragrance-name]")
          ?.dataset.fragranceName ?? null;
      dragStartAngleRef.current = getPointerAngle(event);
      dragStartOffsetRef.current = pathOffsetRef.current;
      draggedRef.current = false;

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      dismissHint();
    },
    [dismissHint, getPointerAngle]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      const pointerAngle = getPointerAngle(event);
      const delta = pointerAngle - dragStartAngleRef.current;
      const normalizedDelta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const nextOffset = dragStartOffsetRef.current + normalizedDelta / TAU;

      if (Math.abs(normalizedDelta) > 0.03) {
        draggedRef.current = true;
        setSuppressClick(true);
      }

      updateOffsetFromPointer(nextOffset);
    },
    [getPointerAngle, updateOffsetFromPointer]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      pointerIdRef.current = null;
      setIsDragging(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }

      if (pendingDragOffsetRef.current !== null) {
        const pending = pendingDragOffsetRef.current;
        pendingDragOffsetRef.current = null;
        pathOffsetRef.current = pending;
        setPathOffset(pending);
      }

      if (!draggedRef.current && pointerDownFragranceNameRef.current) {
        const directNode = nodeByName.get(pointerDownFragranceNameRef.current);
        if (directNode) {
          selectAndAnchor(directNode.fragrance, true);
        }
      } else {
        const nearest = findNearestNode(pathOffsetRef.current);
        if (nearest) {
          selectAndAnchor(nearest.fragrance, true);
        }
      }

      pointerDownFragranceNameRef.current = null;

      if (!draggedRef.current) {
        setTimeout(() => setSuppressClick(false), 0);
        return;
      }

      setTimeout(() => setSuppressClick(false), 120);
    },
    [findNearestNode, nodeByName, selectAndAnchor]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (orderedFragrances.length === 0) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        dismissHint();

        const currentIndex = selectedName
          ? orderedFragrances.findIndex(
              (fragrance) => fragrance.name === selectedName
            )
          : 0;
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;

        const nextIndex =
          (Math.max(currentIndex, 0) + step + orderedFragrances.length) %
          orderedFragrances.length;

        selectAndAnchor(orderedFragrances[nextIndex], true);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleSearchSubmit();
      }
    },
    [dismissHint, handleSearchSubmit, orderedFragrances, selectAndAnchor, selectedName]
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setStageBounds((current) => {
        const next = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };

        if (
          Math.abs(current.width - next.width) < 0.5 &&
          Math.abs(current.height - next.height) < 0.5
        ) {
          return current;
        }

        return next;
      });
    });

    resizeObserver.observe(stage);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const centerCard = centerCardRef.current;
    if (!centerCard) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setCenterCardBounds((current) => {
        const next = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };

        if (
          Math.abs(current.width - next.width) < 0.5 &&
          Math.abs(current.height - next.height) < 0.5
        ) {
          return current;
        }

        return next;
      });
    });

    resizeObserver.observe(centerCard);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  return (
    <section className="sqr-view">
      <div className="sqr-search-wrap">
        <SearchBox
          value={searchTerm}
          onChange={setSearchTerm}
          onSubmit={handleSearchSubmit}
        />
      </div>

      <div className="sqr-stage-shell">
        {showHint && (
          <button
            type="button"
            className="sqr-hint"
            onClick={dismissHint}
            aria-label="Dismiss drag hint"
          >
            Drag to rotate
          </button>
        )}

        <div
          ref={stageRef}
          className={`sqr-stage ${isDragging ? "dragging" : ""}`}
          style={sqrStyle}
          tabIndex={0}
          role="group"
          aria-label="Rectangular city selector. Drag to rotate or use arrow keys."
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="sqr-orbit-guide outer" aria-hidden="true" />
          <div className="sqr-orbit-guide inner" aria-hidden="true" />

          {positionedNodes.map((node) => {
            const isSelected = node.fragrance.name === selectedName;
            const isMatched = matchingNameSet.has(node.fragrance.name);
            const distanceToAnchor = Math.abs(
              normalizeOffsetDelta(ANCHOR_POSITION - node.position)
            );
            const topWeight = 1 - clamp(distanceToAnchor / 0.5, 0, 1);
            const baseOpacity = 0.42 + topWeight * 0.38;
            const visualOpacity = isSelected
              ? 1
              : normalizedSearch.length > 0 && !isMatched
              ? Math.max(0.24, baseOpacity * 0.55)
              : baseOpacity;

            return (
              <CityPill
                key={node.fragrance.name}
                fragrance={node.fragrance}
                x={node.x}
                y={node.y}
                selected={isSelected}
                matched={isMatched}
                visualOpacity={visualOpacity}
                onSelect={(fragrance) => selectAndAnchor(fragrance, true)}
                suppressClick={suppressClick || isDragging}
              />
            );
          })}

          <div className="sqr-center-wrap">
            <CenterCard ref={centerCardRef} fragrance={selectedFragrance} />
          </div>
        </div>
      </div>
    </section>
  );
}

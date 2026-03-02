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

interface DialViewProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
  onSelectFragrance: (fragrance: Fragrance) => void;
}

interface DialNode {
  fragrance: Fragrance;
  baseProgress: number;
  ring: "outer" | "inner";
}

interface RectPath {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  topStraight: number;
  rightStraight: number;
  bottomStraight: number;
  leftStraight: number;
  halfTopStraight: number;
  quarterArc: number;
  perimeter: number;
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
const OUTER_RING_COUNT = 14;
const HINT_DISMISS_KEY = "le-labo-dial-hint-dismissed";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(angle: number): number {
  let normalized = angle % TAU;
  if (normalized > Math.PI) normalized -= TAU;
  if (normalized < -Math.PI) normalized += TAU;
  return normalized;
}

function normalizeProgress(progress: number): number {
  return ((progress % 1) + 1) % 1;
}

function shortestProgressDelta(from: number, to: number): number {
  let delta = normalizeProgress(to - from);
  if (delta > 0.5) {
    delta -= 1;
  }
  return delta;
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

function buildRoundedRectPath(
  stageWidth: number,
  stageHeight: number,
  padX: number,
  padY: number,
  radiusFactor: number
): RectPath {
  const width = Math.max(stageWidth - padX * 2, 180);
  const height = Math.max(stageHeight - padY * 2, 180);

  const x = (stageWidth - width) / 2;
  const y = (stageHeight - height) / 2;

  const maxRadius = Math.max(Math.min(width, height) / 2 - 1, 12);
  const radius = clamp(Math.min(width, height) * radiusFactor, 12, maxRadius);

  const topStraight = Math.max(width - radius * 2, 0);
  const rightStraight = Math.max(height - radius * 2, 0);
  const bottomStraight = topStraight;
  const leftStraight = rightStraight;
  const halfTopStraight = topStraight / 2;
  const quarterArc = (Math.PI * radius) / 2;

  const perimeter =
    halfTopStraight +
    quarterArc +
    rightStraight +
    quarterArc +
    bottomStraight +
    quarterArc +
    leftStraight +
    quarterArc +
    halfTopStraight;

  return {
    x,
    y,
    width,
    height,
    radius,
    topStraight,
    rightStraight,
    bottomStraight,
    leftStraight,
    halfTopStraight,
    quarterArc,
    perimeter,
  };
}

function pointOnRoundedRectPath(path: RectPath, rawProgress: number) {
  const progress = normalizeProgress(rawProgress);
  let distance = progress * path.perimeter;

  const {
    x,
    y,
    width,
    height,
    radius,
    halfTopStraight,
    quarterArc,
    rightStraight,
    bottomStraight,
    leftStraight,
  } = path;

  if (distance <= halfTopStraight) {
    return {
      x: x + width / 2 + distance,
      y,
    };
  }
  distance -= halfTopStraight;

  if (distance <= quarterArc) {
    const theta = -Math.PI / 2 + distance / radius;
    return {
      x: x + width - radius + Math.cos(theta) * radius,
      y: y + radius + Math.sin(theta) * radius,
    };
  }
  distance -= quarterArc;

  if (distance <= rightStraight) {
    return {
      x: x + width,
      y: y + radius + distance,
    };
  }
  distance -= rightStraight;

  if (distance <= quarterArc) {
    const theta = distance / radius;
    return {
      x: x + width - radius + Math.cos(theta) * radius,
      y: y + height - radius + Math.sin(theta) * radius,
    };
  }
  distance -= quarterArc;

  if (distance <= bottomStraight) {
    return {
      x: x + width - radius - distance,
      y: y + height,
    };
  }
  distance -= bottomStraight;

  if (distance <= quarterArc) {
    const theta = Math.PI / 2 + distance / radius;
    return {
      x: x + radius + Math.cos(theta) * radius,
      y: y + height - radius + Math.sin(theta) * radius,
    };
  }
  distance -= quarterArc;

  if (distance <= leftStraight) {
    return {
      x,
      y: y + height - radius - distance,
    };
  }
  distance -= leftStraight;

  if (distance <= quarterArc) {
    const theta = Math.PI + distance / radius;
    return {
      x: x + radius + Math.cos(theta) * radius,
      y: y + radius + Math.sin(theta) * radius,
    };
  }
  distance -= quarterArc;

  return {
    x: x + radius + distance,
    y,
  };
}

function keepPointOutsideRect(
  point: { x: number; y: number },
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number
) {
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= halfWidth || absDy >= halfHeight) {
    return point;
  }

  const xRatio = halfWidth > 0 ? absDx / halfWidth : 0;
  const yRatio = halfHeight > 0 ? absDy / halfHeight : 0;
  const dominantRatio = Math.max(xRatio, yRatio);

  if (dominantRatio <= 0) {
    return { x: centerX + halfWidth, y: centerY };
  }

  const scale = (1 / dominantRatio) * 1.04;
  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  };
}

export default function DialView({
  fragrances,
  selectedFragrance,
  onSelectFragrance,
}: DialViewProps) {
  const orderedFragrances = useMemo(
    () =>
      [...fragrances].sort(
        (first, second) =>
          first.city.localeCompare(second.city) ||
          first.name.localeCompare(second.name)
      ),
    [fragrances]
  );

  const nodes = useMemo<DialNode[]>(() => {
    const outerCount = Math.min(OUTER_RING_COUNT, orderedFragrances.length);
    const innerCount = Math.max(orderedFragrances.length - outerCount, 0);

    const outerStep = outerCount > 0 ? 1 / outerCount : 0;
    const innerStep = innerCount > 0 ? 1 / innerCount : 0;
    const innerOffset = innerCount > 0 ? innerStep / 2 : 0;

    return orderedFragrances.map((fragrance, index) => {
      if (index < outerCount) {
        return {
          fragrance,
          baseProgress: index * outerStep,
          ring: "outer",
        };
      }

      const innerIndex = index - outerCount;
      return {
        fragrance,
        baseProgress: innerIndex * innerStep + innerOffset,
        ring: "inner",
      };
    });
  }, [orderedFragrances]);

  const nodeByName = useMemo(
    () => new Map(nodes.map((node) => [node.fragrance.name, node])),
    [nodes]
  );

  const [rotationOffset, setRotationOffset] = useState(() => {
    if (!selectedFragrance) {
      return 0;
    }

    const selectedNode = nodeByName.get(selectedFragrance.name);
    if (!selectedNode) {
      return 0;
    }

    return normalizeProgress(-selectedNode.baseProgress);
  });
  const rotationOffsetRef = useRef(rotationOffset);

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
  const stageHeight = stageBounds.height || 620;
  const stageCenterX = stageWidth / 2;
  const stageCenterY = stageHeight / 2;
  const isCompactStage = stageWidth <= 720;

  const fallbackCardWidth = Math.min(
    stageWidth * (isCompactStage ? 0.74 : 0.64),
    isCompactStage ? 360 : 520
  );
  const fallbackCardHeight = isCompactStage ? 260 : 230;
  const centerCardWidth = centerCardBounds.width || fallbackCardWidth;
  const centerCardHeight = centerCardBounds.height || fallbackCardHeight;

  const pillHalfWidth = isCompactStage ? 78 : 94;
  const pillHalfHeight = 28;
  const centerClearanceX = centerCardWidth / 2 + pillHalfWidth + 14;
  const centerClearanceY = centerCardHeight / 2 + pillHalfHeight + 14;
  const edgePaddingX = pillHalfWidth + 6;
  const edgePaddingY = pillHalfHeight + 6;

  const outerPath = useMemo(() => {
    const padX = clamp(stageWidth * 0.06, 24, 86);
    const padY = clamp(stageHeight * 0.08, 24, 84);
    return buildRoundedRectPath(stageWidth, stageHeight, padX, padY, 0.12);
  }, [stageHeight, stageWidth]);

  const innerPath = useMemo(() => {
    const padX = clamp(stageWidth * 0.24, 88, 260);
    const padY = clamp(stageHeight * 0.26, 88, 220);
    return buildRoundedRectPath(stageWidth, stageHeight, padX, padY, 0.18);
  }, [stageHeight, stageWidth]);

  const selectedName = selectedFragrance?.name ?? null;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const dialStyle = useMemo(
    () =>
      ({
        "--dial-outer-width": `${outerPath.width}px`,
        "--dial-outer-height": `${outerPath.height}px`,
        "--dial-outer-radius": `${outerPath.radius}px`,
        "--dial-inner-width": `${innerPath.width}px`,
        "--dial-inner-height": `${innerPath.height}px`,
        "--dial-inner-radius": `${innerPath.radius}px`,
      }) as CSSProperties,
    [innerPath, outerPath]
  );

  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const path = node.ring === "outer" ? outerPath : innerPath;
        const point = pointOnRoundedRectPath(
          path,
          node.baseProgress + rotationOffset
        );
        const adjustedPoint = keepPointOutsideRect(
          point,
          stageCenterX,
          stageCenterY,
          centerClearanceX,
          centerClearanceY
        );

        return {
          ...node,
          x: clamp(adjustedPoint.x, edgePaddingX, stageWidth - edgePaddingX),
          y: clamp(adjustedPoint.y, edgePaddingY, stageHeight - edgePaddingY),
        };
      }),
    [
      centerClearanceX,
      centerClearanceY,
      edgePaddingX,
      edgePaddingY,
      innerPath,
      nodes,
      outerPath,
      rotationOffset,
      stageCenterX,
      stageCenterY,
      stageHeight,
      stageWidth,
    ]
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

    const target = normalizeProgress(targetOffset);
    const start = rotationOffsetRef.current;
    const delta = shortestProgressDelta(start, target);

    if (Math.abs(delta) < 0.0002) {
      rotationOffsetRef.current = target;
      setRotationOffset(target);
      return;
    }

    const duration = prefersReducedMotion() ? 0 : 300;
    if (duration === 0) {
      rotationOffsetRef.current = target;
      setRotationOffset(target);
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeInOutQuad(progress);
      const next = normalizeProgress(start + delta * easedProgress);

      rotationOffsetRef.current = next;
      setRotationOffset(next);

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
      return normalizeProgress(-node.baseProgress);
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
        rotationOffsetRef.current = targetOffset;
        setRotationOffset(targetOffset);
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
    (currentOffset: number): DialNode | null => {
      if (nodes.length === 0) {
        return null;
      }

      let nearest: DialNode | null = null;
      let smallestDelta = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        const progress = normalizeProgress(node.baseProgress + currentOffset);
        const delta = Math.abs(shortestProgressDelta(progress, 0));

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
    pendingDragOffsetRef.current = normalizeProgress(nextOffset);

    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragOffsetRef.current;
      if (pending === null) {
        return;
      }

      rotationOffsetRef.current = pending;
      setRotationOffset(pending);
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
      dragStartOffsetRef.current = rotationOffsetRef.current;
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
      const deltaAngle = normalizeAngle(pointerAngle - dragStartAngleRef.current);
      const nextOffset = dragStartOffsetRef.current + deltaAngle / TAU;

      if (Math.abs(deltaAngle) > 0.03) {
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
        rotationOffsetRef.current = pending;
        setRotationOffset(pending);
      }

      if (!draggedRef.current && pointerDownFragranceNameRef.current) {
        const directNode = nodeByName.get(pointerDownFragranceNameRef.current);
        if (directNode) {
          selectAndAnchor(directNode.fragrance, true);
        }
      } else {
        const nearest = findNearestNode(rotationOffsetRef.current);
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
    <section className="dial-view">
      <div className="dial-search-wrap">
        <SearchBox
          value={searchTerm}
          onChange={setSearchTerm}
          onSubmit={handleSearchSubmit}
        />
      </div>

      <div className="dial-stage-shell">
        {showHint && (
          <button
            type="button"
            className="dial-hint"
            onClick={dismissHint}
            aria-label="Dismiss drag hint"
          >
            Drag to rotate
          </button>
        )}

        <div
          ref={stageRef}
          className={`dial-stage ${isDragging ? "dragging" : ""}`}
          style={dialStyle}
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
          <div className="dial-orbit-guide outer" aria-hidden="true" />
          <div className="dial-orbit-guide inner" aria-hidden="true" />

          {positionedNodes.map((node) => {
            const isSelected = node.fragrance.name === selectedName;
            const isMatched = matchingNameSet.has(node.fragrance.name);
            const isDimmed =
              (selectedName !== null && !isSelected) ||
              (normalizedSearch.length > 0 && !isMatched);

            return (
              <CityPill
                key={node.fragrance.name}
                fragrance={node.fragrance}
                x={node.x}
                y={node.y}
                selected={isSelected}
                matched={isMatched}
                dimmed={isDimmed}
                onSelect={(fragrance) => selectAndAnchor(fragrance, true)}
                suppressClick={suppressClick || isDragging}
              />
            );
          })}

          <div className="dial-center-wrap">
            <CenterCard ref={centerCardRef} fragrance={selectedFragrance} />
          </div>
        </div>
      </div>
    </section>
  );
}

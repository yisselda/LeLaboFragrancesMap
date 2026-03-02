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
  baseAngle: number;
  ring: "outer" | "inner";
}

const TAU = Math.PI * 2;
const ANCHOR_ANGLE = -Math.PI / 2;
const OUTER_RING_COUNT = 14;
const HINT_DISMISS_KEY = "le-labo-dial-hint-dismissed";

function normalizeAngle(angle: number): number {
  let normalized = angle % TAU;
  if (normalized > Math.PI) normalized -= TAU;
  if (normalized < -Math.PI) normalized += TAU;
  return normalized;
}

function easeInOutQuad(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
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

    const outerStep = outerCount > 0 ? TAU / outerCount : 0;
    const innerStep = innerCount > 0 ? TAU / innerCount : 0;
    const innerOffset = innerCount > 0 ? innerStep / 2 : 0;

    return orderedFragrances.map((fragrance, index) => {
      if (index < outerCount) {
        return {
          fragrance,
          baseAngle: index * outerStep,
          ring: "outer",
        };
      }

      const innerIndex = index - outerCount;
      return {
        fragrance,
        baseAngle: innerIndex * innerStep + innerOffset,
        ring: "inner",
      };
    });
  }, [orderedFragrances]);

  const nodeByName = useMemo(
    () => new Map(nodes.map((node) => [node.fragrance.name, node])),
    [nodes]
  );

  const [rotation, setRotation] = useState(() => {
    if (!selectedFragrance) {
      return 0;
    }

    const selectedNode = nodeByName.get(selectedFragrance.name);
    if (!selectedNode) {
      return 0;
    }

    return normalizeAngle(ANCHOR_ANGLE - selectedNode.baseAngle);
  });
  const rotationRef = useRef(rotation);

  const animationFrameRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRotationRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const pointerIdRef = useRef<number | null>(null);
  const dragStartAngleRef = useRef(0);
  const dragStartRotationRef = useRef(0);
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
  const [stageSize, setStageSize] = useState(0);

  const effectiveSize = stageSize || 640;
  const outerRadius = Math.min(Math.max(effectiveSize * 0.44, 120), 270);
  const innerRadius = Math.min(Math.max(effectiveSize * 0.29, 78), 188);
  const center = effectiveSize / 2;

  const selectedName = selectedFragrance?.name ?? null;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const dialStyle = useMemo(
    () =>
      ({
        "--dial-outer-diameter": `${outerRadius * 2}px`,
        "--dial-inner-diameter": `${innerRadius * 2}px`,
      }) as CSSProperties,
    [innerRadius, outerRadius]
  );

  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const radius = node.ring === "outer" ? outerRadius : innerRadius;
        const angle = node.baseAngle + rotation;

        return {
          ...node,
          x: center + Math.cos(angle) * radius,
          y: center + Math.sin(angle) * radius,
        };
      }),
    [center, innerRadius, nodes, outerRadius, rotation]
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

  const animateToRotation = useCallback((targetRotation: number) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const target = normalizeAngle(targetRotation);
    const start = rotationRef.current;
    const delta = normalizeAngle(target - start);

    if (Math.abs(delta) < 0.001) {
      rotationRef.current = target;
      setRotation(target);
      return;
    }

    const startTime = performance.now();
    const duration = 300;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeInOutQuad(progress);
      const next = normalizeAngle(start + delta * easedProgress);

      rotationRef.current = next;
      setRotation(next);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const getAnchorRotation = useCallback(
    (fragranceName: string): number | null => {
      const node = nodeByName.get(fragranceName);
      if (!node) {
        return null;
      }
      return normalizeAngle(ANCHOR_ANGLE - node.baseAngle);
    },
    [nodeByName]
  );

  const selectAndAnchor = useCallback(
    (fragrance: Fragrance, animate = true) => {
      const targetRotation = getAnchorRotation(fragrance.name);
      if (targetRotation === null) {
        return;
      }

      onSelectFragrance(fragrance);

      if (animate) {
        animateToRotation(targetRotation);
      } else {
        rotationRef.current = targetRotation;
        setRotation(targetRotation);
      }

      dismissHint();
    },
    [animateToRotation, dismissHint, getAnchorRotation, onSelectFragrance]
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
    (currentRotation: number): DialNode | null => {
      if (nodes.length === 0) {
        return null;
      }

      let nearest: DialNode | null = null;
      let smallestDelta = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        const angle = node.baseAngle + currentRotation;
        const delta = Math.abs(normalizeAngle(ANCHOR_ANGLE - angle));

        if (delta < smallestDelta) {
          smallestDelta = delta;
          nearest = node;
        }
      }

      return nearest;
    },
    [nodes]
  );

  const updateRotationFromPointer = useCallback((nextRotation: number) => {
    pendingDragRotationRef.current = normalizeAngle(nextRotation);

    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragRotationRef.current;
      if (pending === null) {
        return;
      }

      rotationRef.current = pending;
      setRotation(pending);
      pendingDragRotationRef.current = null;
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

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      pointerIdRef.current = event.pointerId;
      dragStartAngleRef.current = getPointerAngle(event);
      dragStartRotationRef.current = rotationRef.current;
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
      const delta = normalizeAngle(pointerAngle - dragStartAngleRef.current);
      const nextRotation = dragStartRotationRef.current + delta;

      if (Math.abs(delta) > 0.03) {
        draggedRef.current = true;
        setSuppressClick(true);
      }

      updateRotationFromPointer(nextRotation);
    },
    [getPointerAngle, updateRotationFromPointer]
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

      if (pendingDragRotationRef.current !== null) {
        const pending = pendingDragRotationRef.current;
        pendingDragRotationRef.current = null;
        rotationRef.current = pending;
        setRotation(pending);
      }

      const nearest = findNearestNode(rotationRef.current);
      if (nearest) {
        selectAndAnchor(nearest.fragrance, true);
      }

      if (!draggedRef.current) {
        setTimeout(() => setSuppressClick(false), 0);
        return;
      }

      setTimeout(() => setSuppressClick(false), 120);
    },
    [findNearestNode, selectAndAnchor]
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

      setStageSize(Math.min(entry.contentRect.width, entry.contentRect.height));
    });

    resizeObserver.observe(stage);
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
          aria-label="Circular city selector. Drag to rotate or use left and right arrow keys."
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
            <CenterCard fragrance={selectedFragrance} />
          </div>
        </div>
      </div>
    </section>
  );
}

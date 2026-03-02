import { useEffect, useState } from "react";
import Header from "./components/Header";
import DialView from "./components/DialView";
import Map from "./components/Map";
import RingView from "./components/RingView";
import Sidebar from "./components/Sidebar";
import ViewToggle from "./components/ViewToggle";
import type { Fragrance } from "./types/fragrance";

type ViewMode = "ring" | "dial" | "map";

const VIEW_STORAGE_KEY = "le-labo-view";
const CITY_STORAGE_KEY = "le-labo-city";
const DEFAULT_VIEW: ViewMode = "dial";

function parseView(value: string | null): ViewMode | null {
  if (value === "ring" || value === "dial" || value === "map") {
    return value;
  }
  return null;
}

function findFragranceByCity(
  fragrances: Fragrance[],
  cityValue: string | null
): Fragrance | null {
  if (!cityValue) {
    return null;
  }

  const normalized = cityValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    fragrances.find(
      (fragrance) => fragrance.city.trim().toLowerCase() === normalized
    ) ?? null
  );
}

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return DEFAULT_VIEW;
  }

  const params = new URLSearchParams(window.location.search);
  const queryView = parseView(params.get("view"));
  if (queryView) {
    return queryView;
  }

  try {
    const storedView = parseView(localStorage.getItem(VIEW_STORAGE_KEY));
    if (storedView) {
      return storedView;
    }
  } catch {
    // Ignore storage access failures.
  }

  return DEFAULT_VIEW;
}

export default function App() {
  const [fragrances, setFragrances] = useState<Fragrance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(
    null
  );
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/fragrances.json")
      .then((res) => res.json())
      .then((data: Fragrance[]) => {
        const sorted = [...data].sort(
          (first, second) =>
            first.city.localeCompare(second.city) ||
            first.name.localeCompare(second.name)
        );

        let initialSelection: Fragrance | null = null;

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          initialSelection = findFragranceByCity(data, params.get("city"));

          if (!initialSelection) {
            try {
              initialSelection = findFragranceByCity(
                data,
                localStorage.getItem(CITY_STORAGE_KEY)
              );
            } catch {
              initialSelection = null;
            }
          }
        }

        setFragrances(data);
        setSelectedFragrance(initialSelection ?? sorted[0] ?? null);
      })
      .catch(() => setError("Failed to load fragrances"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const selectedCity = selectedFragrance?.city ?? null;

    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
      if (selectedCity) {
        localStorage.setItem(CITY_STORAGE_KEY, selectedCity);
      } else {
        localStorage.removeItem(CITY_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access failures.
    }

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("view", viewMode);

    if (selectedCity) {
      url.searchParams.set("city", selectedCity);
    } else {
      url.searchParams.delete("city");
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [loading, selectedFragrance, viewMode]);

  return (
    <>
      <Header />
      {loading ? (
        <div className="loading-state">
          <div className="loading-message">Loading fragrances...</div>
        </div>
      ) : error ? (
        <div className="error-state">
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <div className="app-shell">
          <div className="view-toolbar">
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === "ring" ? (
            <RingView
              fragrances={fragrances}
              selectedFragrance={selectedFragrance}
              onSelectFragrance={setSelectedFragrance}
            />
          ) : viewMode === "dial" ? (
            <DialView
              fragrances={fragrances}
              selectedFragrance={selectedFragrance}
              onSelectFragrance={setSelectedFragrance}
            />
          ) : (
            <div className="list-view-layout">
              <Sidebar
                fragrances={fragrances}
                selectedFragrance={selectedFragrance}
                onSelectFragrance={setSelectedFragrance}
              />
              <Map
                fragrances={fragrances}
                selectedFragrance={selectedFragrance}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

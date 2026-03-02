import { useEffect, useState } from "react";
import Header from "./components/Header";
import DialView from "./components/DialView";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import ViewToggle from "./components/ViewToggle";
import type { Fragrance } from "./types/fragrance";

export default function App() {
  const [fragrances, setFragrances] = useState<Fragrance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"dial" | "list">("list");

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/fragrances.json")
      .then((res) => res.json())
      .then((data: Fragrance[]) => {
        setFragrances(data);
        setSelectedFragrance((current) => current ?? data[0] ?? null);
      })
      .catch(() => setError("Failed to load fragrances"))
      .finally(() => setLoading(false));
  }, []);

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

          {viewMode === "dial" ? (
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

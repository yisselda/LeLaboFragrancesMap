import { useEffect, useState } from "react";
import Header from "./components/Header";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import type { Fragrance } from "./types/fragrance";

export default function App() {
  const [fragrances, setFragrances] = useState<Fragrance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(
    null
  );

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/fragrances.json")
      .then((res) => res.json())
      .then(setFragrances)
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
        <div style={{ display: "flex", flex: 1, width: "100%" }}>
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
    </>
  );
}

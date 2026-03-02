import { useState, useMemo } from "react";
import type { Fragrance } from "../types/fragrance";

interface SidebarProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
  onSelectFragrance: (fragrance: Fragrance | null) => void;
}

export default function Sidebar({
  fragrances,
  selectedFragrance,
  onSelectFragrance,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFragrances = useMemo(() => {
    if (!searchTerm.trim()) return fragrances;
    const term = searchTerm.toLowerCase();
    return fragrances.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.city.toLowerCase().includes(term)
    );
  }, [fragrances, searchTerm]);

  return (
    <div className="sidebar">
      <div className="sidebar-search-container">
        <input
          type="text"
          className="sidebar-search"
          placeholder="Search by name or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="sidebar-list">
        {filteredFragrances.map((fragrance) => (
          <div
            key={fragrance.name}
            className={`sidebar-card ${
              selectedFragrance?.name === fragrance.name ? "selected" : ""
            }`}
            onClick={() => onSelectFragrance(fragrance)}
          >
            <div className="sidebar-card-name">{fragrance.name}</div>
            <div className="sidebar-card-location">
              {fragrance.city}, {fragrance.country}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ViewToggleProps {
  value: "ring" | "dial" | "map";
  onChange: (value: "ring" | "dial" | "map") => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={value === "ring"}
        className={`view-toggle-button ${value === "ring" ? "active" : ""}`}
        onClick={() => onChange("ring")}
      >
        Ring
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "dial"}
        className={`view-toggle-button ${value === "dial" ? "active" : ""}`}
        onClick={() => onChange("dial")}
      >
        Dial
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "map"}
        className={`view-toggle-button ${value === "map" ? "active" : ""}`}
        onClick={() => onChange("map")}
      >
        Map
      </button>
    </div>
  );
}

interface ViewToggleProps {
  value: "dial" | "list";
  onChange: (value: "dial" | "list") => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="tablist" aria-label="View mode">
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
        aria-selected={value === "list"}
        className={`view-toggle-button ${value === "list" ? "active" : ""}`}
        onClick={() => onChange("list")}
      >
        Map
      </button>
    </div>
  );
}

import type { KeyboardEvent } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}

export default function SearchInput({ value, onChange, onEnter }: SearchInputProps) {
  return (
    <div className="ring-search-wrap">
      <label htmlFor="ring-search" className="sr-only">
        Search city, fragrance, country
      </label>
      <input
        id="ring-search"
        type="search"
        className="ring-search-input"
        placeholder="Search city, fragrance, country"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

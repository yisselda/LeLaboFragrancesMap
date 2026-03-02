interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function SearchBox({ value, onChange, onSubmit }: SearchBoxProps) {
  return (
    <form
      className="dial-search-box"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="dial-search">
        Search city exclusives
      </label>
      <input
        id="dial-search"
        type="search"
        className="dial-search-input"
        placeholder="Search city, fragrance, country"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" className="dial-search-submit">
        Go
      </button>
    </form>
  );
}

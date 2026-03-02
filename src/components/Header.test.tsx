import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Header from "./Header";

describe("Header", () => {
  it("renders the title", () => {
    render(<Header />);
    expect(screen.getByText("Le Labo City Exclusives")).toBeInTheDocument();
  });

  it("renders the disclaimer", () => {
    render(<Header />);
    expect(
      screen.getAllByText(/not affiliated with le labo/i).length
    ).toBeGreaterThan(0);
  });
});

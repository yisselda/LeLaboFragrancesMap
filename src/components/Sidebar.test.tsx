import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "./Sidebar";
import { mockFragrances } from "../test/fixtures";

describe("Sidebar", () => {
  it("renders all fragrances", () => {
    render(
      <Sidebar
        fragrances={mockFragrances}
        selectedFragrance={null}
        onSelectFragrance={() => {}}
      />
    );
    expect(screen.getByText("GAIAC 10")).toBeInTheDocument();
    expect(screen.getByText("VANILLE 44")).toBeInTheDocument();
  });

  it("filters fragrances by search term", () => {
    render(
      <Sidebar
        fragrances={mockFragrances}
        selectedFragrance={null}
        onSelectFragrance={() => {}}
      />
    );
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "tokyo" } });
    expect(screen.getByText("GAIAC 10")).toBeInTheDocument();
    expect(screen.queryByText("VANILLE 44")).not.toBeInTheDocument();
  });

  it("calls onSelectFragrance when a card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <Sidebar
        fragrances={mockFragrances}
        selectedFragrance={null}
        onSelectFragrance={onSelect}
      />
    );
    fireEvent.click(screen.getByText("GAIAC 10"));
    expect(onSelect).toHaveBeenCalledWith(mockFragrances[0]);
  });

  it("highlights the selected fragrance", () => {
    const { container } = render(
      <Sidebar
        fragrances={mockFragrances}
        selectedFragrance={mockFragrances[0]}
        onSelectFragrance={() => {}}
      />
    );
    const selectedCard = container.querySelector(".sidebar-card.selected");
    expect(selectedCard).toBeInTheDocument();
    expect(selectedCard?.textContent).toContain("GAIAC 10");
  });
});

import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Map from "./Map";
import { mockFragrances } from "../test/fixtures";

describe("Map", () => {
  it("renders the leaflet container", () => {
    const { container } = render(
      <Map fragrances={[]} selectedFragrance={null} />
    );
    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });

  it("renders with fragrances without crashing", () => {
    const { container } = render(
      <Map fragrances={mockFragrances} selectedFragrance={null} />
    );
    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });
});

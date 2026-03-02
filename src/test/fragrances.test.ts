import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Fragrance } from "../types/fragrance";

const dataPath = resolve(__dirname, "../../public/data/fragrances.json");
const fragrances: (Fragrance & Record<string, unknown>)[] = JSON.parse(
  readFileSync(dataPath, "utf-8")
);

describe("fragrances.json", () => {
  it("contains 18 entries", () => {
    expect(fragrances).toHaveLength(18);
  });

  it("has unique names", () => {
    const names = fragrances.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has unique cities", () => {
    const cities = fragrances.map((f) => f.city);
    expect(new Set(cities).size).toBe(cities.length);
  });

  it("has valid coordinates for each entry", () => {
    for (const f of fragrances) {
      expect(f.lat).toBeGreaterThanOrEqual(-90);
      expect(f.lat).toBeLessThanOrEqual(90);
      expect(f.lng).toBeGreaterThanOrEqual(-180);
      expect(f.lng).toBeLessThanOrEqual(180);
    }
  });

  it("has valid URLs for each entry", () => {
    for (const f of fragrances) {
      expect(f.url).toMatch(
        /^https:\/\/www\.lelabofragrances\.com\/.+\.html$/
      );
    }
  });

  it("has all required fields for each entry", () => {
    for (const f of fragrances) {
      expect(f.name).toBeTruthy();
      expect(f.city).toBeTruthy();
      expect(f.country).toBeTruthy();
      expect(typeof f.lat).toBe("number");
      expect(typeof f.lng).toBe("number");
      expect(f.url).toBeTruthy();
    }
  });

  it("has notes as string arrays when present", () => {
    for (const f of fragrances) {
      if (f.notes) {
        expect(Array.isArray(f.notes)).toBe(true);
        for (const note of f.notes) {
          expect(typeof note).toBe("string");
        }
      }
    }
  });
});

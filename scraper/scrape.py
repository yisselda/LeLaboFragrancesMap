#!/usr/bin/env python3
"""Scrape Le Labo city exclusives and update fragrances.json."""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

CITY_EXCLUSIVES_URL = "https://www.lelabofragrances.com/city-exclusives"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "fragrances.json"

# Hardcoded geocoding for known Le Labo cities
CITY_COORDS: dict[str, tuple[float, float, str]] = {
    "Tokyo": (35.6762, 139.6503, "Japan"),
    "Paris": (48.8566, 2.3522, "France"),
    "Berlin": (52.52, 13.405, "Germany"),
    "Miami": (25.7617, -80.1918, "USA"),
    "Amsterdam": (52.3676, 4.9041, "Netherlands"),
    "Los Angeles": (34.0522, -118.2437, "USA"),
    "New York": (40.7128, -74.006, "USA"),
    "Hong Kong": (22.3193, 114.1694, "China"),
    "Seoul": (37.5665, 126.978, "South Korea"),
    "Shanghai": (31.2304, 121.4737, "China"),
    "Moscow": (55.7558, 37.6173, "Russia"),
    "Dubai": (25.2048, 55.2708, "UAE"),
    "Dallas": (32.7767, -96.797, "USA"),
    "Mexico City": (19.4326, -99.1332, "Mexico"),
    "Chicago": (41.8781, -87.6298, "USA"),
    "London": (51.5074, -0.1278, "UK"),
    "Kyoto": (35.0116, 135.7681, "Japan"),
    "San Francisco": (37.7749, -122.4194, "USA"),
}

# Reverse lookup: lowercase city names to canonical names for fuzzy matching
CITY_LOOKUP = {city.lower(): city for city in CITY_COORDS}


class ScraperStats:
    """Track statistics during scraping."""

    def __init__(self) -> None:
        self.total_products_found: int = 0
        self.successfully_mapped: dict[str, str] = {}  # name -> city
        self.skipped: dict[str, str] = {}  # name -> reason
        self.unknown_cities: set[str] = set()

    def add_success(self, name: str, city: str) -> None:
        """Record a successfully mapped fragrance."""
        self.successfully_mapped[name] = city

    def add_skip(self, name: str, reason: str) -> None:
        """Record a skipped fragrance with reason."""
        self.skipped[name] = reason

    def add_unknown_city(self, city: str) -> None:
        """Record an unknown city detected."""
        self.unknown_cities.add(city)

    def print_summary(self) -> None:
        """Print a comprehensive summary."""
        print("\n" + "=" * 70)
        print("SCRAPER SUMMARY")
        print("=" * 70)
        print(f"Total products found on city exclusives page: {self.total_products_found}")
        print(
            f"Successfully mapped: {len(self.successfully_mapped)} fragrances"
        )
        if self.successfully_mapped:
            for name, city in sorted(self.successfully_mapped.items()):
                print(f"  ✓ {name:40s} → {city}")

        if self.skipped:
            print(f"\nSkipped / Failed: {len(self.skipped)} fragrances")
            for name, reason in sorted(self.skipped.items()):
                print(f"  ✗ {name:40s} — {reason}")

        if self.unknown_cities:
            print(f"\nWARNING: Unknown cities detected (not in CITY_COORDS):")
            for city in sorted(self.unknown_cities):
                print(f"  ⚠ {city}")
            print(
                "  Please add these cities to CITY_COORDS in scrape.py"
                " and update README."
            )

        print("=" * 70 + "\n")


def fetch_page(url: str, max_retries: int = 2) -> Optional[BeautifulSoup]:
    """
    Fetch a URL and return parsed HTML.

    Args:
        url: The URL to fetch
        max_retries: Number of retry attempts on failure (default 2)

    Returns:
        BeautifulSoup object or None if fetch fails after retries
    """
    headers = {"User-Agent": "LeLaboFragrancesMap/1.0 (educational project)"}

    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff: 1, 2 seconds
                print(
                    f"    Retry {attempt + 1}/{max_retries} after {wait_time}s"
                    f" (error: {type(e).__name__})"
                )
                time.sleep(wait_time)
            else:
                print(f"    FAILED after {max_retries + 1} attempts: {type(e).__name__}")
                return None


def extract_city_from_json_ld(soup: BeautifulSoup) -> Optional[str]:
    """
    Try to extract city from JSON-LD structured data.

    Returns:
        City name if found and recognized, None otherwise
    """
    scripts = soup.find_all("script", {"type": "application/ld+json"})
    for script in scripts:
        try:
            data = json.loads(script.string)
            # Check common fields that might contain city info
            for field in ["description", "name"]:
                if field in data:
                    city = _extract_city_from_text(data[field])
                    if city:
                        return city
        except (json.JSONDecodeError, AttributeError, TypeError):
            # Skip malformed or empty JSON-LD blocks
            pass
    return None


def extract_city_from_meta_tags(soup: BeautifulSoup) -> Optional[str]:
    """
    Try to extract city from meta tags.

    Checks og:description, description, and other meta fields.

    Returns:
        City name if found and recognized, None otherwise
    """
    meta_tags = [
        ("property", "og:description"),
        ("name", "description"),
        ("name", "og:description"),
    ]

    for attr_name, attr_value in meta_tags:
        meta = soup.find("meta", {attr_name: attr_value})
        if meta and meta.get("content"):
            city = _extract_city_from_text(meta["content"])
            if city:
                return city
    return None


def extract_city_from_title(soup: BeautifulSoup) -> Optional[str]:
    """
    Try to extract city from page title.

    Returns:
        City name if found and recognized, None otherwise
    """
    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        return _extract_city_from_text(title_tag.string)
    return None


def extract_city_from_regex(soup: BeautifulSoup) -> Optional[str]:
    """
    Fall back to regex pattern matching on page text.

    Looks for patterns like "available exclusively in our {City} lab".

    Returns:
        City name if found and recognized, None otherwise
    """
    text = soup.get_text()
    # Look for patterns like "available exclusively in our {City} lab"
    match = re.search(
        r"(?:available|exclusive)[^.]*?(?:in\s+(?:our\s+)?)([\w\s]+?)"
        r"(?:\s+lab|\s+shop|\s+store)",
        text,
        re.IGNORECASE,
    )
    if match:
        return _extract_city_from_text(match.group(1))
    return None


def _extract_city_from_text(text: str) -> Optional[str]:
    """
    Extract a recognized city name from text.

    Tries exact match, then fuzzy substring matching against known cities.

    Args:
        text: Raw text that may contain a city name

    Returns:
        Canonical city name if recognized, None otherwise
    """
    if not text:
        return None

    text_lower = text.lower().strip()

    # Exact match
    if text_lower in CITY_LOOKUP:
        return CITY_LOOKUP[text_lower]

    # Fuzzy match: check if any known city is mentioned as a substring
    for city in CITY_COORDS:
        city_lower = city.lower()
        if city_lower in text_lower:
            return city

    return None


def extract_city_from_product_page(
    soup: BeautifulSoup, url: str = ""
) -> tuple[Optional[str], list[str]]:
    """
    Try to extract the city name from a product page using multiple heuristics.

    Tries methods in this order:
    1. JSON-LD structured data
    2. Meta tags (og:description, description)
    3. Page title
    4. Original regex patterns (last resort)

    Args:
        soup: Parsed HTML of the product page
        url: URL of the page (for logging)

    Returns:
        Tuple of (found_city, unknown_cities_detected)
        found_city is None if no recognized city was found.
        unknown_cities_detected is a list of city names found in the page
        but not recognized in CITY_COORDS.
    """
    unknown_cities: list[str] = []

    # Try each method in order
    methods = [
        ("JSON-LD", extract_city_from_json_ld),
        ("Meta tags", extract_city_from_meta_tags),
        ("Page title", extract_city_from_title),
        ("Regex pattern", extract_city_from_regex),
    ]

    for method_name, method_func in methods:
        city = method_func(soup)
        if city:
            return city, unknown_cities

    # If no recognized city found, try to extract unrecognized city names
    text = soup.get_text()
    for city_candidate in re.findall(
        r"(?:in\s+(?:our\s+)?)([\w\s]+?)(?:\s+lab|\s+shop|\s+store)",
        text,
        re.IGNORECASE,
    ):
        candidate_clean = city_candidate.strip()
        if candidate_clean and candidate_clean.lower() not in CITY_LOOKUP:
            unknown_cities.append(candidate_clean)

    return None, list(set(unknown_cities))


def scrape_city_exclusives(
    stats: ScraperStats,
) -> list[dict]:
    """
    Scrape the Le Labo city exclusives page for fragrance data.

    Args:
        stats: ScraperStats object to track results

    Returns:
        List of fragrance dictionaries
    """
    print("Fetching city exclusives page...")
    soup = fetch_page(CITY_EXCLUSIVES_URL)
    if not soup:
        print("ERROR: Failed to fetch city exclusives page. Aborting.")
        return []

    fragrances: list[dict] = []

    # Find product links on the city exclusives page
    product_links = soup.find_all("a", href=re.compile(r"lelabofragrances\.com.*"))
    product_links = [
        link
        for link in product_links
        if re.search(r"\.html($|\?)", link.get("href", ""))
    ]

    print(f"Found {len(product_links)} product links on city exclusives page.")
    stats.total_products_found = len(product_links)

    seen_urls: set[str] = set()
    for idx, link in enumerate(product_links, 1):
        url = link.get("href", "")
        if not url or url in seen_urls:
            continue
        if not url.startswith("http"):
            url = "https://www.lelabofragrances.com" + url
        seen_urls.add(url)

        # Extract fragrance name from link text or URL
        name = link.get_text(strip=True)
        if not name:
            # Derive from URL: /gaiac-10.html → GAIAC 10
            slug = url.rsplit("/", 1)[-1].split("?")[0].replace(".html", "")
            name = re.sub(r"-(\d)", r" \1", slug)

        print(f"  [{idx}/{len(product_links)}] Fetching {name}...")

        # Try to find city from the product page
        try:
            print(f"    Fetching product page: {url}")
            product_soup = fetch_page(url)
            if not product_soup:
                stats.add_skip(name, "Failed to fetch product page (network error)")
                continue

            city, unknown_cities = extract_city_from_product_page(product_soup, url)

            # Track unknown cities
            for unknown_city in unknown_cities:
                stats.add_unknown_city(unknown_city)

            if not city:
                if unknown_cities:
                    reason = (
                        f"Unrecognized cities found: {', '.join(unknown_cities)}"
                    )
                else:
                    reason = "No city found in product page"
                stats.add_skip(name, reason)
                continue

            # City is guaranteed to be in CITY_COORDS by the extraction functions
            lat, lng, country = CITY_COORDS[city]
            fragrances.append(
                {
                    "name": name.upper(),
                    "city": city,
                    "country": country,
                    "lat": lat,
                    "lng": lng,
                    "url": url,
                }
            )
            stats.add_success(name.upper(), city)
            print(f"    ✓ Mapped to {city}, {country}")

        except Exception as e:
            stats.add_skip(name, f"Unexpected error: {type(e).__name__}: {str(e)}")
            print(f"    ERROR: {type(e).__name__}: {str(e)}")

    return fragrances


def main(dry_run: bool = False) -> None:
    """
    Main entry point.

    Args:
        dry_run: If True, don't write the output file, just report what would change
    """
    stats = ScraperStats()
    print("Scraping Le Labo city exclusives...\n")
    fragrances = scrape_city_exclusives(stats)

    stats.print_summary()

    if not fragrances:
        print("No fragrances found. Keeping existing data.")
        return

    # Load existing data for comparison
    existing: list[dict] = []
    if OUTPUT_PATH.exists():
        existing = json.loads(OUTPUT_PATH.read_text())

    # Sort by name for stable diffs
    fragrances.sort(key=lambda f: f["name"])
    existing.sort(key=lambda f: f["name"])

    if fragrances == existing:
        print(f"No changes detected ({len(fragrances)} fragrances).")
        return

    existing_names = {f["name"] for f in existing}
    new_names = {f["name"] for f in fragrances}
    added = new_names - existing_names
    removed = existing_names - new_names

    if dry_run:
        print("[DRY RUN] Would write the following changes:")
        print(f"  Output: {OUTPUT_PATH}")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps(fragrances, indent=2) + "\n")
        print(f"Updated {OUTPUT_PATH}")

    print(f"  Total: {len(fragrances)} fragrances")
    if added:
        print(f"  Added: {', '.join(sorted(added))}")
    if removed:
        print(f"  Removed: {', '.join(sorted(removed))}")

    if dry_run:
        print("[DRY RUN] File not written.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape Le Labo city exclusives and update fragrances.json"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run the full scrape but don't write the output file",
    )
    args = parser.parse_args()

    try:
        main(dry_run=args.dry_run)
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nFATAL ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)

# CLAUDE.md

## Project

Le Labo City Exclusives Map — an interactive world map visualizing Le Labo's 18 city-exclusive fragrances. Built with React + TypeScript + Leaflet, deployed to GitHub Pages.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build to `dist/`
- `npm run lint` — Run ESLint
- `npx tsc --noEmit` — Type-check without emitting
- `python scraper/scrape.py` — Scrape Le Labo site and update `public/data/fragrances.json`
- `cd terraform && terraform plan` — Preview infrastructure changes

## Architecture

- `src/` — React app (Vite + TypeScript)
  - `App.tsx` — Root: fetches data, renders Header + Map
  - `components/Header.tsx` — Title bar with disclaimer
  - `components/Map.tsx` — Leaflet map with CircleMarkers and popups
  - `types/fragrance.ts` — `Fragrance` interface
  - `index.css` — Global styles (Le Labo brand aesthetic)
- `public/data/fragrances.json` — Static dataset of 18 city exclusives
- `scraper/` — Python scraper to detect new exclusives
- `.github/workflows/` — Deploy (on push) and scrape (weekly cron)
- `terraform/` — GitHub repo + Pages config via Terraform

## Key Details

- Vite `base` is set to `/LeLaboFragrancesMap/` for GitHub Pages
- Map tiles: CartoDB Positron (monochrome)
- Data fetched at runtime from `data/fragrances.json`
- No backend — pure static site

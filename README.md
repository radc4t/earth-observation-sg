<div align="center">

# Singapore from Space

**Earth observation, made visible — a scrolling data story about one island, read from orbit.**

[![Live demo](https://img.shields.io/badge/live-demo-0e5a6b?style=flat-square)](https://radc4t.github.io/earth-observation-sg/)
[![CI](https://img.shields.io/github/actions/workflow/status/radc4t/earth-observation-sg/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/radc4t/earth-observation-sg/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No framework](https://img.shields.io/badge/build-vanilla%20ES%20modules-informational?style=flat-square)](#run-it-locally)

[![Singapore from Space — the Field Report data story: the hero chapter over a live Sentinel‑2 satellite map](docs/hero.jpg)](https://radc4t.github.io/earth-observation-sg/)

### ▶ **[View the live story →](https://radc4t.github.io/earth-observation-sg/)**

</div>

---

## What this is

A public‑communication prototype for an Earth Observation Initiative. Saying _"we observe the Earth
from space"_ means little on its own — _"here is what Singapore looks like from space, and here is
what the data tells you about your environment"_ is immediate.

So this is a **scrolling data story** — an editorial "field report", not a dashboard — built around
one real, pannable satellite map that flies between locations as you scroll. It reveals three things
the eye can’t see from the ground: **green cover** (a vegetation index), **urban heat** (the land
surface temperature), and **maritime traffic** in the Singapore Strait.

## The story — seven chapters over one live map

An intro, three real data layers, a side‑by‑side compare beat, a methods note and a closing summary.
A **chapter‑navigation rail** shows the active chapter over a thin scroll‑progress bar; click a dot
to jump, and share any chapter by its deep‑link (for example, `#compare`).

| Chapter        | Layer                         | What you’re looking at                                                     |
| -------------- | ----------------------------- | -------------------------------------------------------------------------- |
| **Intro**      | —                             | The island from orbit — the invitation to scroll                           |
| **Vegetation** | NDVI                          | Living green cover, from dense Central‑Catchment canopy to bare worksites  |
| **Urban heat** | Land‑surface temperature (°C) | Where the ground runs hottest — industrial Jurong/Tuas vs. the cool centre |
| **Compare**    | NDVI ⇄ temperature            | "Two views, one island" — drag a divider to split the two rasters          |
| **Maritime**   | Vessel traffic                | The Strait’s shipping lanes — container ships, tankers, bulk carriers      |
| **Methods**    | —                             | Field‑notes on how each picture was made, with full provenance             |
| **Summary**    | —                             | Land, heat and sea — one island, observed                                  |

**Two ways to read a number, not just a colour:**

- **Headline figures, derived from the pixels.** Each data chapter carries one big figure computed
  from the shipped raster — the Central Catchment forest reads **0.83 NDVI**, and the industrial west
  runs **≈9 °C hotter** than the forested centre. The team does not type these numbers: `npm run stats`
  computes them from the overlays, and a CI test fails if they drift.
- **Click to inspect.** Click (or press <kbd>Enter</kbd> / <kbd>R</kbd>) anywhere on an active layer
  to read the **actual value** under that point — an NDVI reading with its vegetation class, or the
  temperature in °C — announced to assistive tech.

![The Urban heat chapter: Landsat 9 land‑surface‑temperature overlay across Singapore — industrial Jurong and Tuas glowing hot on the inferno ramp while reservoirs and the forested centre stay cool and masked — beside the chapter’s field‑note card and a 33–48 °C legend](docs/chapter-heat.jpg)

<sub>The **Urban heat** chapter — real Landsat 9 surface temperature (6 Jul 2025) over the live Sentinel‑2 basemap; water, cloud and shadow masked.</sub>

## Real vs. illustrative — read this first

Honesty about what is real is a core value here. The interface says it plainly in every layer’s
provenance line; in full:

| Element             | Status             | Source & processing                                                                                        |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Satellite basemap   | **Real**           | [EOX Sentinel‑2 cloudless](https://s2maps.eu) (default) + [Esri Light Gray](https://www.esri.com) — no key |
| Vegetation (NDVI)   | **Real**           | Sentinel‑2 L2A, 28 Jul 2024; cloud & water masked; 10 m source → ~16 m/px display                          |
| Surface temperature | **Real**           | Landsat 9 Collection‑2, 6 Jul 2025; cloud/shadow/water masked before resampling; ~32 m/px                  |
| Compare view        | **Real** over real | The same two rasters above, split by a divider over one frozen frame — a cross‑date pattern comparison     |
| Vessel tracks       | **Illustration**   | **Simulated** — labelled "not live AIS"; wired to accept a real feed via a one‑line swap                   |

A few notes on the real layers:

- The vegetation overlay is real Sentinel‑2 NDVI. The script
  [`build_real_ndvi.py`](scripts/generate-placeholders/build_real_ndvi.py) builds it from the free AWS
  Open Data mirror. The source bands are **10 m**. The overlay is that source resampled to **~16 m/px**
  for display. Do not describe the overlay as a 10 m raster — a single full‑res PNG would be far too
  large, and a COG/XYZ tile pipeline is the path to true full resolution.
- The heat overlay is real Landsat 9 land‑surface temperature in **°C**. The script
  [`build_real_thermal.py`](scripts/generate-placeholders/build_real_thermal.py) builds it from the
  keyless Microsoft Planetary Computer. It masks cloud, shadow and water _before_ it resamples, so
  cloud edges do not bleed. Landsat’s thermal band is 100 m (USGS‑resampled to 30 m), displayed at
  ~32 m/px.
- The vessel layer shows simulated tracks. The legend and the Methods chapter both say "Simulated
  tracks — not live AIS". To connect a real AIS feed, change one line — see
  [`docs/swap-instructions.md`](docs/swap-instructions.md).

This separation keeps the prototype truthful while the storytelling is proven, and shows exactly where
real rasters and live AIS drop in.

## Design & motion — the "Field Report" system

The look is a deliberate editorial identity, not a default map UI:

- **Type.** Three self‑hosted faces (all SIL OFL): **Source Serif 4** (display), **Inter** (body/UI),
  **IBM Plex Mono** (data & coordinates). Bundled as hashed `woff2` — no webfont CDN.
- **Design tokens.** One semantic token system — colour (`--paper`, `--panel`, `--ink`, `--accent`),
  spacing and radius scales, and a small **motion vocabulary** — defined once and themed for
  **light (primary) and dark** (`prefers-color-scheme`, with a manual toggle that persists and wins
  over the OS).
- **Solid, legible panels.** Editorial story cards with a coordinate stamp, date and snapshot note; a
  legend with a colour ramp, numeric ticks and a calm provenance line; a click‑to‑read **inspector**
  with a crosshair reticle. No translucent "glass".
- **Native motion, not a library.** The scroll engine stays native (IntersectionObserver + Leaflet
  `flyTo`); a small **transition coordinator** in [`js/scrolly.js`](js/scrolly.js) gives each hand‑off
  a rhythm — _camera glides → the data develops in on the tail of the glide → chrome settles → the card
  arrives last._ Vegetation↔Heat cross‑fades in place (a legend "ramp morph"); **Compare** clips the
  two rasters against a draggable divider; the maritime layer **travels in with the camera**. Every
  timing lives once in [`js/motion.js`](js/motion.js), mirrored as CSS tokens. No Lenis, no GSAP, no
  new dependency.
- **Orientation, gently.** The chapter‑nav rail and progress bar ([`js/nav.js`](js/nav.js)) and a soft
  scroll‑snap let scrolling rest on a composed chapter; the active chapter mirrors into the URL hash
  for shareable deep‑links, honoured live on `hashchange`.
- **Icons.** A tiny inline [Lucide](https://lucide.dev) set (theme, explore, disclosure, close,
  external, crosshair) — actions get icons; meaning stays in words.

## Accessibility

- **Reduced motion is a first‑class path.** With `prefers-reduced-motion: reduce`, every camera glide,
  fade, legend morph, card reveal and vessel drift is instant/static — nothing animates.
- **Keyboard & AT.** A skip‑link goes to the story. The map takes focus and reads its value on
  <kbd>Enter</kbd> / <kbd>R</kbd> with an `aria-live` announcement. The nav dots are real buttons with
  accessible names and `aria-current`. Controls show a focus ring and carry `aria-pressed` /
  `aria-expanded`. The page has one `h1` and one `h2` per chapter.
- **Colour.** Colourblind‑safe ramps (viridis / inferno, no red‑green); AA‑checked text; a
  `forced-colors` high‑contrast pass and a print stylesheet.
- **Mobile.** A bottom‑sheet story over a fixed map, an "Explore map" peek, and a bottom‑sheet reading
  — a tap reads a value, a drag scrolls the story.

## Run it locally

No build step — vanilla ES modules + [Leaflet](https://leafletjs.com) from a CDN. You need internet
access for the map tiles.

```bash
git clone https://github.com/radc4t/earth-observation-sg.git
cd earth-observation-sg
python3 -m http.server 8000        # open http://localhost:8000
```

Do you edit the JavaScript or CSS but not see your changes? A plain `http.server` sends no cache
headers, so the browser keeps the old modules and can run stale code. Use the no‑cache server, and
open it from the `127.0.0.1` origin. That origin is distinct from `localhost`, so the browser never
reuses a cached module map.

```bash
python3 scripts/nocache_server.py   # serves . on 127.0.0.1:8000, Cache-Control: no-store
# open http://127.0.0.1:8000
```

## Tooling — lint / format / test / build / deploy

The optional dev tooling uses `npm` (Node 18+) and Python `ruff`. The app itself never needs a build
to run.

```bash
npm install            # install the dev tools and the Husky pre-commit hook
npm run lint           # run ESLint on the ES modules
npm run format         # run Prettier; format:check runs in CI
npm test               # run the unit tests and the science tests (node --test)
npm run stats          # print the per-chapter headline figures from the real overlay PNGs
npm run build          # build with esbuild into dist/ (bundle.js, style.min.css, index.html, assets/)
npm run preview        # build, then serve dist/
ruff check scripts/ && ruff format scripts/   # check the Python scripts (pip install ruff)
```

**CI** ([`ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request: ESLint, the
Prettier check, `npm run build` and `npm test`, plus Ruff and the `ramps.py` self‑test. Two tests keep
the data honest — a **scientific check** samples the real overlays at pinned coordinates and asserts
the documented NDVI / °C bands, and a **stats guard** re‑derives the on‑card headline figures from the
pixels. A data or ramp regression fails CI. **Deploy** ([`pages.yml`](.github/workflows/pages.yml))
builds `dist/` and publishes to GitHub Pages on push to `main` — a fresh fork needs the one‑time
setting Settings → Pages → Source → **GitHub Actions**. **Pre‑commit** (Husky + lint‑staged) runs
ESLint and Prettier on staged files, and Ruff on `*.py` if it is installed.

> **Why Leaflet, not a WebGL map?** Leaflet draws raster tiles as plain `<img>` — no web worker, no
> WebGL context, no tile‑CORS requirement — so it works in every browser and embedded preview, and a
> flat top‑down view reads more truthfully than a tilted 3D one. The `L` global is intentional: a CDN
> classic `<script>` loads before the deferred bundle, so esbuild leaves the bare `L` as a runtime
> `window.L`. The swap hooks and story structure are engine‑agnostic.

## Regenerating the data overlays

The placeholder overlays need `numpy` + `Pillow`. The **real** rasters also need `rasterio`.

```bash
pip install rasterio numpy pillow
python3 scripts/generate-placeholders/build_real_ndvi.py      # real Sentinel-2 NDVI
python3 scripts/generate-placeholders/build_real_thermal.py   # real Landsat surface temp
```

After a rebuild, run `npm run stats` and update the headline figures in
[`js/metadata.js`](js/metadata.js). The stats test checks that these numbers still match the pixels.

## Project structure

```
index.html                 hero + 7 chapters (Intro→Veg→Heat→Compare→Maritime→Methods→Summary)
                           + map + legend + inspector + chapter-nav rail
css/style.css              Field Report design system: tokens, light/dark, cards, legend, motion,
                           responsive/mobile, reduced-motion, print, forced-colors
js/
  app.js                   entry point — wires map/story/overlays/inspect/compare/nav/theme/mobile
  config.js                SECTIONS — the story: camera, overlay, legend, copy per chapter
  map.js                   Leaflet init, basemap panes + cross-fade toggle, overlay registration
  scrolly.js               IntersectionObserver → flyTo + the transition coordinator (choreography)
  compare.js               "two views, one island" swipe — clips both rasters against a divider
  nav.js                   chapter-nav rail + scroll-progress bar + URL-hash deep-link sync
  inspect.js               click / Enter → read the NDVI value or °C at a point (desktop + mobile)
  sample.js                canvas pixel sampler + LUT reverse-lookup (for the inspector)
  stats.js                 derive per-chapter headline figures from the real overlay pixels
  metadata.js              LAYER_META — single provenance source; builds Methods + headline stats
  ramps.js                 viridis/inferno stops — single source (JS + Python both read it)
  motion.js                motion tokens (durations/easings) — single source, mirrored in CSS
  state.js                 tiny central store (section, basemap, overlays, reduced-motion)
  theme.js                 light/dark manual override on top of prefers-color-scheme (persisted)
  mobile.js                bottom-sheet "Explore map" behaviour (sole owner of the mobile state)
  icons.js                 inline Lucide SVG set (decorative; controls carry the accessible name)
  layers/
    ndvi.js                vegetation image overlay + inspect() + swapWithRealRaster()
    thermal.js             thermal image overlay + inspect() + swapWithRealRaster()
    maritime.js            animated vessels + rAF loop + replaceWithRealAIS()
assets/fonts/              self-hosted woff2 (Source Serif 4, Inter, IBM Plex Mono — SIL OFL)
assets/overlays/           ndvi_real.png + thermal_real.png (real); ndvi.png/thermal.png (placeholders)
test/                      node --test: pure logic + real-PNG scientific + stats honesty + motion sync
                           (compare, nav, stats, legend, sample, science, metadata, ramps, motion)
scripts/
  build.mjs                esbuild production build → dist/
  compute-stats.mjs        print the honest per-chapter headline figures (npm run stats)
  nocache_server.py        no-store dev server on 127.0.0.1 (see "Run it locally")
  generate-placeholders/
    ramps.py               loads the colour ramps from js/ramps.js (single source)
    generate_overlays.py   reproducible placeholder generator
    build_real_ndvi.py     real Sentinel-2 NDVI pipeline (AWS STAC + rasterio)
    build_real_thermal.py  real Landsat surface temp (Planetary Computer + rasterio)
docs/swap-instructions.md  per-layer real-data swap guide
.github/workflows/         ci.yml + pages.yml
```

## Single source of truth

Nothing is kept in sync by hand:

| What             | Lives once in                           | Consumed by                                                        |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Colour ramps     | [`js/ramps.js`](js/ramps.js)            | the legends, the inspector reverse‑lookup, and the Python builders |
| Provenance       | [`js/metadata.js`](js/metadata.js)      | the legends, the Methods chapter, and the About panel              |
| Headline figures | [`js/stats.js`](js/stats.js) → metadata | the cards, `npm run stats`, and `test/stats.test.js` (CI guard)    |
| Motion timings   | [`js/motion.js`](js/motion.js)          | the JS engine and CSS tokens, checked by `test/motion.test.js`     |

## Possible extensions (the architecture already supports them)

- **Change over decades** — one more data chapter and layer module over the Landsat archive
  (1980s→now), to show land reclamation, Changi’s expansion and new HDB estates appearing. The
  highest‑value next step for a portfolio piece.
- **Real rasters + live AIS** — via the swap hooks in [`docs/swap-instructions.md`](docs/swap-instructions.md).
- **True full‑resolution rasters** — a COG / XYZ tile pipeline instead of a single resampled PNG.

## Credits & data

- **Imagery & basemaps:** Sentinel‑2 cloudless © [EOX IT Services GmbH](https://s2maps.eu) (contains
  modified Copernicus Sentinel data); Esri Light Gray Canvas — Tiles © Esri, HERE, Garmin,
  © OpenStreetMap contributors, and the GIS user community.
- **Data:** Copernicus **Sentinel‑2** (ESA) via the AWS Open Data mirror; **Landsat 9** (USGS/NASA)
  via the Microsoft Planetary Computer.
- **Type:** Source Serif 4, Inter, IBM Plex Mono — all SIL Open Font License. **Icons:** Lucide (ISC).
  **Map rendering:** Leaflet.

## License

[MIT](LICENSE) © radc4t. The bundled fonts are under the SIL Open Font License; Leaflet is
BSD‑2‑Clause; Lucide icons are ISC. Satellite imagery and data are © their respective providers (see
Credits) and subject to their terms.

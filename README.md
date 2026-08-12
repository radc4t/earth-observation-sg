# Singapore from Space — Earth Observation, made visible

A scrolling data story that shows citizens what Singapore looks like from
Earth-observation satellites, and explains what the data reveals: **green cover**
(vegetation index), **urban heat** (land-surface temperature), and **maritime traffic**
in the Singapore Strait. Built around a real, pannable satellite map that flies between
locations as you scroll.

> Public-communication prototype for an Earth Observation Initiative. _"We observe the
> Earth from space"_ means little on its own — _"here is what Singapore looks like from
> space, and here is what the data tells you about your environment"_ is immediate.

## Real vs. illustrative — read this first

- **Real basemap:** the satellite **basemap** is genuine, free, no-API-key public
  imagery — [EOX Sentinel-2 cloudless](https://s2maps.eu) (Copernicus Sentinel-2) and
  [Esri World Imagery](https://www.esri.com). Toggle between them, pan and zoom freely.
- **Real NDVI:** the **vegetation layer is genuine Sentinel-2 NDVI** (28 Jul 2024, clouds
  & water masked), computed from the free AWS Open Data Sentinel-2 L2A mirror by
  [`scripts/generate-placeholders/build_real_ndvi.py`](scripts/generate-placeholders/build_real_ndvi.py).
  The source bands are **10 m**; the exported overlay is that source resampled to
  **~16 m/px** for display — it is _not_ a 10 m raster (a single full-resolution PNG would
  be far too large; a COG/XYZ tile pipeline is the path to true full-res, noted below).
- **Real surface temperature:** the **thermal layer is genuine Landsat 9** Collection-2
  land-surface temperature in real **°C** (6 Jul 2025; cloud, shadow & water masked via
  QA_PIXEL + QA_RADSAT, masked _before_ resampling so cloud edges don't bleed), from the
  keyless Microsoft Planetary Computer archive via
  [`scripts/generate-placeholders/build_real_thermal.py`](scripts/generate-placeholders/build_real_thermal.py).
  Landsat's thermal band is 100 m (USGS-resampled to 30 m), displayed at ~32 m/px.
- **One illustration remains:** the **vessel layer** shows _simulated_ tracks, tagged in
  its legend — **not** live AIS. Wired to accept a real AIS feed via a one-line swap — see
  [`docs/swap-instructions.md`](docs/swap-instructions.md).

This honest separation is deliberate: it keeps the prototype truthful while the visual
storytelling is proven, and shows exactly where real rasters/AIS drop in.

## Run it (no build step)

```bash
cd earth-observation-sg
python3 -m http.server 8000
# open http://localhost:8000
```

Development stays **build-free** — vanilla ES modules + [Leaflet](https://leafletjs.com)
from a CDN (needs internet for map tiles). The optimized bundle below is only for
deployment.

## Tooling (lint / format / build / deploy)

Optional dev tooling lives behind `npm` (Node 18+) and Python `ruff`; the app itself never
requires a build to run.

```bash
npm install            # devDeps + installs the Husky pre-commit hook
npm run lint           # ESLint (vanilla ES modules)
npm run format         # Prettier (js/css/html/md); `format:check` in CI
npm run build          # esbuild → dist/ (bundle.js, style.min.css, index.html, assets/)
npm run preview        # build, then serve dist/ locally
ruff check scripts/ && ruff format scripts/   # Python asset scripts (pip install ruff)
```

- **CI** (`.github/workflows/ci.yml`): on every push/PR, runs ESLint + Prettier check +
  `npm run build` (JS) and Ruff check/format (Python).
- **Deploy** (`.github/workflows/pages.yml`): on push to `main`, builds `dist/` and
  publishes to **GitHub Pages**. **One-time manual step:** in the repo, _Settings → Pages →
  Source → GitHub Actions_.
- **Pre-commit** (Husky + lint-staged): runs ESLint/Prettier (and Ruff on `*.py`) over
  staged files. Ruff must be installed locally (`pip install ruff`) for the Python step.

The Leaflet `L` global is intentional: it's a CDN classic `<script>`, loaded before the
deferred module bundle, so esbuild leaves the bare `L` as a runtime `window.L` reference.

> **Why Leaflet, not a WebGL map?** Leaflet renders raster tiles as plain `<img>` — no
> web worker, no WebGL context, no tile-CORS requirement — so it is robust in every
> browser and embedded preview. For satellite imagery a flat, top-down view also reads
> more truthfully than a tilted 3D one. The swap hooks and story structure are
> engine-agnostic.

Regenerating the **placeholder** overlays needs `numpy` + `Pillow`. Rebuilding the
**real Sentinel-2 NDVI** needs `rasterio` as well:

```bash
pip install rasterio numpy pillow
python3 scripts/generate-placeholders/build_real_ndvi.py   # real NDVI from Sentinel-2 L2A
```

## Structure

```
index.html                 hero + scroll steps + map + legend + "About the data" panel
css/style.css              layout, glass cards, legend, responsive/mobile, reduced-motion
js/
  app.js                   entry point (wires map/story/overlays/inspect) — the bundle entry
  config.js                SECTIONS — the story: camera, overlay, legend, copy per step
  map.js                   Leaflet init, basemap layers + toggle, overlay registration, errors
  scrolly.js               IntersectionObserver → flyTo (isFlying-guarded) + overlay + legend
  metadata.js              LAYER_META — single source for provenance; builds the About panel
  ramps.js                 viridis/inferno stops — single source (JS + Python both read it)
  state.js                 tiny central store (section, basemap, overlays, reduced-motion)
  sample.js                canvas pixel sampler + LUT reverse-lookup (for inspect)
  inspect.js               click the map → popup with the NDVI value / °C at that point
  layers/
    ndvi.js                vegetation image overlay + inspect() + swapWithRealRaster()
    thermal.js             thermal image overlay + inspect() + swapWithRealRaster()
    maritime.js            animated vessels + rAF loop + replaceWithRealAIS()
assets/overlays/           ndvi_real.png + thermal_real.png (real); ndvi.png/thermal.png (placeholders)
scripts/generate-placeholders/ramps.py               loads the ramps from js/ramps.js (single source)
scripts/generate-placeholders/generate_overlays.py   reproducible placeholder generator
scripts/generate-placeholders/build_real_ndvi.py     real Sentinel-2 NDVI pipeline (AWS STAC + rasterio)
scripts/generate-placeholders/build_real_thermal.py  real Landsat surface temp (Planetary Computer + rasterio)
scripts/build.mjs          esbuild production build → dist/
docs/swap-instructions.md  per-layer real-data swap guide
package.json               npm scripts + devDeps (eslint, prettier, esbuild, husky, lint-staged)
eslint.config.mjs          ESLint 9 flat config      .prettierrc.json / .prettierignore
pyproject.toml             Ruff config (Python)      .github/workflows/{ci,pages}.yml
```

**Colour-ramp single source of truth:** the viridis (NDVI) and inferno (thermal) stops
live in one file, `js/ramps.js`. `config.js` imports it for the legend gradients, the
inspect tool reverse-looks-up against it, and the Python builders parse it via `ramps.py`
— so the overlays, legends and click-readouts can't drift. Nothing to keep in sync by hand.

## Design / robustness notes

- **Click to inspect:** click the map to read the real value under the cursor — an NDVI
  value and vegetation class, or °C for temperature (both, when both layers are visible),
  and "no reading here" over masked pixels. It samples the overlay PNG on a hidden canvas
  and reverse-looks-up the ramp, then shows source + date from metadata. (`js/inspect.js`,
  `js/sample.js`.)
- **Central state (`js/state.js`):** a single small store holds the active section,
  basemap, visible overlays and reduced-motion; `scrolly.js` and the basemap toggle write
  to it and the inspect tool reads from it — a seam future features (time slider, compare)
  can extend.
- **Scroll storytelling:** each step card drives a `map.flyTo`; an `isFlying` guard
  collapses rapid-scroll retargets to the latest destination.
- **Accessibility:** colourblind-safe ramps (viridis / inferno, no red-green), keyboard
  map navigation, ARIA on the basemap toggle and legend, `prefers-reduced-motion` honoured.
- **Graceful degradation:** tile / overlay load failures are caught (`map.on('error')`)
  and surfaced as a "layer unavailable" note instead of a blank page.
- **Mobile:** cards stack full-width and bottom-anchored so the satellite map stays
  visible and interactive above them; the legend collapses to a single tap.

## Possible extensions (architecture already supports them)

- **Change over decades** — add a fourth `SECTIONS` entry + layer module using the
  Landsat archive (1980s→now) to show land reclamation, Changi's expansion and new HDB
  estates appearing. This is the highest-value next step for a portfolio piece.
- **Real rasters + live AIS** — via the swap hooks in `docs/swap-instructions.md`.

## Credits

Basemaps © EOX IT Services GmbH · © Esri, Maxar, Earthstar Geographics · Contains
modified Copernicus Sentinel data. Rendering by Leaflet.

# Singapore from Space — Earth Observation, made visible

A scrolling data story that shows citizens what Singapore looks like from
Earth-observation satellites, and explains what the data reveals: **green cover**
(vegetation index), **urban heat** (land-surface temperature), and **maritime traffic**
in the Singapore Strait. Built around a real, pannable satellite map that flies between
locations as you scroll.

> Public-communication prototype for an Earth Observation Initiative. *"We observe the
> Earth from space"* means little on its own — *"here is what Singapore looks like from
> space, and here is what the data tells you about your environment"* is immediate.

## Real vs. illustrative — read this first

- **Real basemap:** the satellite **basemap** is genuine, free, no-API-key public
  imagery — [EOX Sentinel-2 cloudless](https://s2maps.eu) (Copernicus Sentinel-2) and
  [Esri World Imagery](https://www.esri.com). Toggle between them, pan and zoom freely.
- **Real NDVI:** the **vegetation layer is genuine Sentinel-2 NDVI** (28 Jul 2024, clouds
  & water masked), computed from the free AWS Open Data Sentinel-2 L2A mirror by
  [`scripts/generate-placeholders/build_real_ndvi.py`](scripts/generate-placeholders/build_real_ndvi.py).
  The source bands are **10 m**; the exported overlay is that source resampled to
  **~16 m/px** for display — it is *not* a 10 m raster (a single full-resolution PNG would
  be far too large; a COG/XYZ tile pipeline is the path to true full-res, noted below).
- **Real surface temperature:** the **thermal layer is genuine Landsat 9** Collection-2
  land-surface temperature in real **°C** (6 Jul 2025; cloud, shadow & water masked via
  QA_PIXEL + QA_RADSAT, masked *before* resampling so cloud edges don't bleed), from the
  keyless Microsoft Planetary Computer archive via
  [`scripts/generate-placeholders/build_real_thermal.py`](scripts/generate-placeholders/build_real_thermal.py).
  Landsat's thermal band is 100 m (USGS-resampled to 30 m), displayed at ~32 m/px.
- **One illustration remains:** the **vessel layer** shows *simulated* tracks, tagged in
  its legend — **not** live AIS. Wired to accept a real AIS feed via a one-line swap — see
  [`docs/swap-instructions.md`](docs/swap-instructions.md).

This honest separation is deliberate: it keeps the prototype truthful while the visual
storytelling is proven, and shows exactly where real rasters/AIS drop in.

## Run it

```bash
cd earth-observation-sg
python3 -m http.server 8000
# open http://localhost:8000
```
No build step — vanilla ES modules + [Leaflet](https://leafletjs.com) from a CDN
(needs internet for map tiles). Regenerating the placeholder overlays needs Python with
`numpy` + `Pillow`.

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
  config.js                SECTIONS — the story: camera, overlay, legend, copy per step
  map.js                   Leaflet init, basemap layers + toggle, overlay registration, errors
  scrolly.js               IntersectionObserver → flyTo (isFlying-guarded) + overlay + legend
  layers/
    ndvi.js                vegetation image overlay + swapWithRealRaster()
    thermal.js             thermal image overlay + swapWithRealRaster()
    maritime.js            animated vessels + rAF loop + replaceWithRealAIS()
assets/overlays/           ndvi_real.png + thermal_real.png (real); ndvi.png/thermal.png (placeholders)
scripts/generate-placeholders/generate_overlays.py   reproducible placeholder generator
scripts/generate-placeholders/build_real_ndvi.py     real Sentinel-2 NDVI pipeline (AWS STAC + rasterio)
scripts/generate-placeholders/build_real_thermal.py  real Landsat surface temp (Planetary Computer + rasterio)
docs/swap-instructions.md  per-layer real-data swap guide
```

**Colour-ramp single source of truth:** the viridis (NDVI) and inferno (thermal) hex
stops live in `generate_overlays.py` and are mirrored in the `config.js` legend
gradients. Change one, change the other — a paired-edit note sits in both files.

## Design / robustness notes

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

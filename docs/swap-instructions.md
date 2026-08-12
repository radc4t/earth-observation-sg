# Swapping placeholders for real Earth-observation data

The prototype ships with **real satellite basemaps** and **illustrative placeholder
overlays**. Each overlay is wired to accept real data through a single documented
function. This guide covers the swap for each layer.

> The basemaps (EOX Sentinel-2 cloudless, Esri World Imagery) are already real, free,
> no-key sources — nothing to swap there.

---

## 1. NDVI (vegetation) — `js/layers/ndvi.js`  ✅ already real

**Live layer:** `assets/overlays/ndvi_real.png` — **genuine Sentinel-2 NDVI** (28 Jul 2024,
clouds & water masked; 10 m source resampled to ~16 m/px for display), built by
[`scripts/generate-placeholders/build_real_ndvi.py`](../scripts/generate-placeholders/build_real_ndvi.py).
That script finds the least-cloudy Sentinel-2 L2A scene over Singapore via the free,
keyless AWS Open Data mirror (Earth Search STAC), reads the red/NIR/SCL bands with
`rasterio`, computes NDVI, masks cloud/shadow/water via the scene-classification band,
and colourises with the shared viridis ramp. Rebuild it any time:

```bash
python3 scripts/generate-placeholders/build_real_ndvi.py   # needs rasterio + numpy + Pillow
```

**Placeholder (kept for reference / offline):** `assets/overlays/ndvi.png`, from
`generate_overlays.py`. Positioned by the same Leaflet bounds rectangle.

**Swap to a different raster** (e.g. a Copernicus Browser / Sentinel Hub export — NDVI =
(NIR − Red)/(NIR + Red), bands B8/B4 — clipped to the same bounds):
```js
import { ndviLayer } from './js/layers/ndvi.js';
// Leaflet bounds: [[south, west], [north, east]]
ndviLayer.swapWithRealRaster(map, 'assets/overlays/ndvi_real.png', bounds);
```
If you keep the same bounds, omit `bounds` (it defaults to the placeholder's rectangle).
**Keep the colour ramp in sync:** if you re-colour, update both the ramp in
`generate_overlays.py` and the `VIRIDIS_STOPS` legend gradient in `js/config.js`.

---

## 2. Thermal / land-surface temperature — `js/layers/thermal.js`  ✅ already real

**Live layer:** `assets/overlays/thermal_real.png` — **genuine Landsat 9 Collection-2
land-surface temperature** in real °C (6 Jul 2025, cloud & shadow masked), built by
[`scripts/generate-placeholders/build_real_thermal.py`](../scripts/generate-placeholders/build_real_thermal.py).
That script finds the least-cloudy Landsat 8/9 L2 scene over Singapore via the free,
keyless **Microsoft Planetary Computer** STAC + SAS signing API, reads the ST_B10 band
(`lwir11`), `qa_pixel` and `qa_radsat` with `rasterio`, converts DN → °C
(`DN*0.00341802 + 149.0 − 273.15`), and **masks cloud/shadow/water/fill/saturation at the
source resolution — before resampling** (so a clear pixel next to a cloud isn't
contaminated by bilinear mixing). Opacity is constant (colour encodes temperature, not
opacity), and it colourises inferno over a robust °C range. The display range
(tminC/tmaxC in `js/metadata.js`) drives the legend ticks. Rebuild any time:

```bash
python3 scripts/generate-placeholders/build_real_thermal.py   # needs rasterio + numpy + Pillow
```

**Placeholder (kept for reference):** `assets/overlays/thermal.png`, from `generate_overlays.py`.

**Swap to a different raster** (e.g. your own Landsat/ECOSTRESS export, same bounds):
```js
import { thermalLayer } from './js/layers/thermal.js';
// Leaflet bounds: [[south, west], [north, east]]
thermalLayer.swapWithRealRaster(map, 'assets/overlays/thermal_real.png', bounds);
```
If you re-colour, keep `INFERNO_STOPS` in the Python scripts and `js/config.js` in sync,
and update tminC/tmaxC in `js/metadata.js` so the legend ticks match.

---

## 3. Maritime / vessel traffic — `js/layers/maritime.js`

**Placeholder:** ~25 vessels animated along hand-drawn shipping-lane spines.

**Expected real-data schema — read carefully:**
`replaceWithRealAIS(map, featureCollection)` expects a GeoJSON **`FeatureCollection` of
`LineString` features** — historical track lines — each with a
`properties.vesselType` string (one of `Container`, `Tanker`, `Bulk Carrier`,
`Passenger` to reuse the existing colours; other values fall back to a default).
Optional `properties.id` and `properties.knots` are used in the click popup.

```js
import { maritimeLayer } from './js/layers/maritime.js';
maritimeLayer.replaceWithRealAIS(map, {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature',
      properties: { id: 'IMO9321483', vesselType: 'Container', knots: 14 },
      geometry: { type: 'LineString', coordinates: [[104.10,1.18],[103.9,1.17], /* … */] } },
    // …
  ],
});
```

**Not supported out of the box:** live *point*-based AIS feeds (one timestamped point
per vessel per update). Those need a different animation engine that advances points by
timestamp rather than interpolating along a fixed line — that is a separate extension,
not this swap hook. Convert a point feed into per-vessel LineString tracks first, or
extend the animation loop in `maritime.js`.
```
```

---

## Regenerating the placeholder overlays

```bash
python3 scripts/generate-placeholders/generate_overlays.py   # needs numpy + Pillow
```
This rewrites `assets/overlays/ndvi.png` and `thermal.png` and prints the bounding box
(west/south/east/north) — use it as the Leaflet overlay bounds `[[south, west], [north, east]]`.

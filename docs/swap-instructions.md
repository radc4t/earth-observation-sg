# Swapping placeholders for real Earth-observation data

The prototype ships with **real satellite basemaps** and **illustrative placeholder
overlays**. Each overlay is wired to accept real data through a single documented
function. This guide covers the swap for each layer.

> The basemaps (EOX Sentinel-2 cloudless, Esri World Imagery) are already real, free,
> no-key sources — nothing to swap there.

---

## 1. NDVI (vegetation) — `js/layers/ndvi.js`

**Placeholder:** `assets/overlays/ndvi.png` (viridis ramp), positioned by a Leaflet
bounds rectangle that matches the `BBOX` in
`scripts/generate-placeholders/generate_overlays.py`.

**Get real data:** compute NDVI = (NIR − Red) / (NIR + Red) from a Sentinel-2 scene
(bands B8 and B4) over Singapore — e.g. in the Copernicus Browser, Sentinel Hub, or
Google Earth Engine — and export a colour-mapped PNG/GeoTIFF clipped to the same bounds.

**Swap (one call):**
```js
import { ndviLayer } from './js/layers/ndvi.js';
// Leaflet bounds: [[south, west], [north, east]]
ndviLayer.swapWithRealRaster(map, 'assets/overlays/ndvi_real.png', bounds);
```
If you keep the same bounds, omit `bounds` (it defaults to the placeholder's rectangle).
**Keep the colour ramp in sync:** if you re-colour, update both the ramp in
`generate_overlays.py` and the `VIRIDIS_STOPS` legend gradient in `js/config.js`.

---

## 2. Thermal / land-surface temperature — `js/layers/thermal.js`

**Placeholder:** `assets/overlays/thermal.png` (inferno ramp), same corner mechanism.

**Get real data:** derive Land Surface Temperature from a Landsat 8/9 thermal band
(Band 10, TIRS) — many published recipes exist — and export a colour-mapped raster
clipped to the same bounds.

**Swap (one call):**
```js
import { thermalLayer } from './js/layers/thermal.js';
// Leaflet bounds: [[south, west], [north, east]]
thermalLayer.swapWithRealRaster(map, 'assets/overlays/thermal_real.png', bounds);
```
Keep `INFERNO_STOPS` in `generate_overlays.py` and `js/config.js` in sync if re-coloured.

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

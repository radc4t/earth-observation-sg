// ndvi.js — Vegetation index (NDVI) overlay (Leaflet image overlay).
//
// REAL DATA: assets/overlays/ndvi_real.png is genuine Sentinel-2 NDVI (10 m), built by
// scripts/generate-placeholders/build_real_ndvi.py from the free AWS Open Data Sentinel-2
// L2A mirror — clouds and water masked, colourised with the shared viridis ramp.
// (The illustrative placeholder assets/overlays/ndvi.png remains for reference / offline.)
// To swap in a different raster, call `ndviLayer.swapWithRealRaster(map, url, bounds)` —
// see docs/swap-instructions.md.

// Bounds MUST match BBOX in generate_overlays.py.
// Leaflet bounds order: [[south, west], [north, east]]
const BOUNDS = [
  [1.205, 103.60],
  [1.475, 104.04],
];

const ACTIVE_OPACITY = 0.82;

import { sampleImageNorm, buildLut } from '../sample.js';
import { RAMPS } from '../ramps.js';
import { LAYER_META } from '../metadata.js';

const LUT = buildLut(RAMPS.viridis);

function ndviClass(v) {
  if (v >= 0.7) return 'dense vegetation';
  if (v >= 0.5) return 'moderate vegetation';
  if (v >= 0.3) return 'sparse / mixed';
  return 'bare / built';
}

export const ndviLayer = {
  id: 'ndvi-overlay',
  key: 'ndvi',
  sourceId: 'ndvi-source',
  _layer: null,

  // Read the NDVI value at a lat/lng from the displayed overlay. Returns
  // { value, unit, cls } | { masked:true } | null. Used by the click-to-inspect tool.
  inspect(latlng) {
    if (!this._layer) return null;
    const r = sampleImageNorm(this._layer.getElement(), BOUNDS, latlng, LUT);
    if (!r || r.masked) return { masked: true };
    const m = LAYER_META.ndvi;
    const v = m.displayMin + r.norm * (m.displayMax - m.displayMin);
    return { value: v.toFixed(2), unit: '', cls: ndviClass(v) };
  },

  add(map) {
    if (this._layer) return;
    this._layer = L.imageOverlay('assets/overlays/ndvi_real.png', BOUNDS, {
      opacity: 0,
      interactive: false,
      className: 'data-overlay',
    }).addTo(map);
    if (this._layer.getElement()) this._layer.getElement().style.transition = 'opacity .5s ease';
  },

  setVisible(map, visible) {
    if (!this._layer) return;
    this._layer.setOpacity(visible ? ACTIVE_OPACITY : 0);
    if (visible && this._layer.bringToFront) this._layer.bringToFront();
  },

  // Swap the placeholder for a real georeferenced raster (same [[S,W],[N,E]] bounds).
  swapWithRealRaster(map, url, bounds = BOUNDS) {
    if (!this._layer) return;
    this._layer.setUrl(url);
    if (this._layer.setBounds) this._layer.setBounds(bounds);
  },
};

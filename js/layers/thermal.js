// thermal.js — Land-surface-temperature (urban heat island) overlay.
//
// REAL DATA: assets/overlays/thermal_real.png is genuine Landsat 9 Collection-2 surface
// temperature (°C), built by scripts/generate-placeholders/build_real_thermal.py from the
// keyless Microsoft Planetary Computer Landsat archive — cloud/shadow masked, colourised
// with the shared inferno ramp over a real °C range (see js/metadata.js tminC/tmaxC).
// (The illustrative placeholder assets/overlays/thermal.png remains for reference.)
// To swap in a different raster, call `thermalLayer.swapWithRealRaster(map, url, bounds)`
// — see docs/swap-instructions.md.

// Bounds MUST match BBOX in generate_overlays.py. Order: [[south, west], [north, east]]
const BOUNDS = [
  [1.205, 103.60],
  [1.475, 104.04],
];

const ACTIVE_OPACITY = 0.8;

import { sampleImageNorm, buildLut } from '../sample.js';
import { RAMPS } from '../ramps.js';
import { LAYER_META } from '../metadata.js';

const LUT = buildLut(RAMPS.inferno);

export const thermalLayer = {
  id: 'thermal-overlay',
  key: 'thermal',
  sourceId: 'thermal-source',
  _layer: null,

  // Read the surface temperature (°C) at a lat/lng from the displayed overlay. Returns
  // { value, unit } | { masked:true } | null. Used by the click-to-inspect tool.
  inspect(latlng) {
    if (!this._layer) return null;
    const r = sampleImageNorm(this._layer.getElement(), BOUNDS, latlng, LUT);
    if (!r || r.masked) return { masked: true };
    const m = LAYER_META.thermal;
    const c = m.tminC + r.norm * (m.tmaxC - m.tminC);
    return { value: c.toFixed(1), unit: ' °C' };
  },

  add(map) {
    if (this._layer) return;
    this._layer = L.imageOverlay('assets/overlays/thermal_real.png', BOUNDS, {
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

  swapWithRealRaster(map, url, bounds = BOUNDS) {
    if (!this._layer) return;
    this._layer.setUrl(url);
    if (this._layer.setBounds) this._layer.setBounds(bounds);
  },
};

// Scientific integrity test: samples the REAL overlay PNGs at pinned coordinates via the same
// geometry + reverse-lookup + value conversion the app uses, and asserts the documented value
// bands. Fails if the PNG, ramp, or metadata drift. pngjs (dev-only) decodes the PNG canvas-free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { buildLut, latLngToPixel, lutIndexForRgb } from '../js/sample.js';
import { RAMPS } from '../js/ramps.js';
import { LAYER_META } from '../js/metadata.js';
import { BOUNDS } from '../js/layers/ndvi.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const readPng = (rel) => PNG.sync.read(fs.readFileSync(path.join(dir, '..', rel)));

// Mirror sampleImageNorm() without a canvas: pixel -> RGBA -> mask check BEFORE RGB -> reverse-lookup.
function sampleNorm(png, latlng, lut) {
  const p = latLngToPixel(BOUNDS, latlng, png.width, png.height);
  if (!p) return { masked: true };
  const i = (p.py * png.width + p.px) * 4;
  const r = png.data[i];
  const g = png.data[i + 1];
  const b = png.data[i + 2];
  const alpha = png.data[i + 3];
  if (alpha < 8) return { masked: true }; // alpha/no-data checked before interpreting RGB
  return { norm: lutIndexForRgb(r, g, b, lut) / 255 };
}

test('real NDVI: a forest point (Central Catchment) reads in the dense-vegetation band', () => {
  const png = readPng('assets/overlays/ndvi_real.png');
  const m = LAYER_META.ndvi;
  const res = sampleNorm(png, { lat: 1.354, lng: 103.79 }, buildLut(RAMPS.viridis));
  assert.ok(!res.masked, 'forest point should carry data, not mask');
  const ndvi = m.displayMin + res.norm * (m.displayMax - m.displayMin);
  assert.ok(ndvi >= 0.7, `NDVI ${ndvi.toFixed(3)} should be dense (>= 0.7)`);
  assert.ok(ndvi <= m.displayMax + 0.001, `NDVI ${ndvi.toFixed(3)} within display max`);
});

test('real thermal: a Jurong industrial point reads in the hot-°C band', () => {
  const png = readPng('assets/overlays/thermal_real.png');
  const m = LAYER_META.thermal;
  const res = sampleNorm(png, { lat: 1.32, lng: 103.69 }, buildLut(RAMPS.inferno));
  assert.ok(!res.masked, 'Jurong point should carry data, not mask');
  const celsius = m.tminC + res.norm * (m.tmaxC - m.tminC);
  assert.ok(
    celsius >= 40 && celsius <= 47,
    `°C ${celsius.toFixed(1)} should be in hot band [40, 47]`
  );
});

test('an open-sea point reads masked (no-data) on both real layers', () => {
  const sea = { lat: 1.26, lng: 103.75 };
  assert.equal(
    sampleNorm(readPng('assets/overlays/ndvi_real.png'), sea, buildLut(RAMPS.viridis)).masked,
    true
  );
  assert.equal(
    sampleNorm(readPng('assets/overlays/thermal_real.png'), sea, buildLut(RAMPS.inferno)).masked,
    true
  );
});

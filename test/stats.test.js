// Honesty guard for the per-chapter headline stats: recomputes each figure from the REAL overlay
// PNG (same pngjs + reverse-LUT the app uses) and asserts it matches the number shown on the card
// (stored in LAYER_META.*.headline) within a small tolerance. If the overlay, ramp, region defs, or
// a hand-pasted figure drift, CI fails — the same contract as test/science.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { buildLut } from '../js/sample.js';
import { RAMPS } from '../js/ramps.js';
import { LAYER_META } from '../js/metadata.js';
import { BOUNDS } from '../js/layers/ndvi.js';
import { greenHeartNDVI, heatGapC } from '../js/stats.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const readPng = (rel) => PNG.sync.read(fs.readFileSync(path.join(dir, '..', rel)));

test('vegetation headline matches the real NDVI overlay (green heart)', () => {
  const m = LAYER_META.ndvi;
  const green = greenHeartNDVI(
    readPng('assets/overlays/ndvi_real.png'),
    BOUNDS,
    buildLut(RAMPS.viridis),
    m.displayMin,
    m.displayMax
  );
  const shown = parseFloat(m.headline.value);
  assert.ok(green >= 0.7, `green heart ${green.toFixed(3)} should read as dense canopy`);
  assert.ok(
    Math.abs(green - shown) <= 0.02,
    `NDVI headline ${shown} vs derived ${green.toFixed(3)} (>0.02 drift)`
  );
});

test('urban-heat headline matches the real thermal overlay (industrial − forest gap)', () => {
  const m = LAYER_META.thermal;
  const heat = heatGapC(
    readPng('assets/overlays/thermal_real.png'),
    BOUNDS,
    buildLut(RAMPS.inferno),
    m.tminC,
    m.tmaxC
  );
  const shown = parseFloat(m.headline.value);
  assert.ok(
    heat.industrial > heat.forest,
    'industrial west should be hotter than the forested centre'
  );
  assert.ok(
    Math.abs(heat.gap - shown) <= 0.5,
    `heat-gap headline ${shown} vs derived ${heat.gap.toFixed(1)} (>0.5 drift)`
  );
});

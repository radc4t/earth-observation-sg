// compute-stats.mjs — derive the per-chapter headline figures from the shipped overlay PNGs and
// print them, so the numbers in js/metadata.js are honest and reproducible. Run: `npm run stats`.
// Decodes the PNGs canvas-free with pngjs and reuses the app's own reverse-LUT (js/stats.js →
// js/sample.js), so what it reports is exactly what the on-screen overlay encodes. Read-only.

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

const m = LAYER_META;
const ndviImg = readPng('assets/overlays/ndvi_real.png');
const thermalImg = readPng('assets/overlays/thermal_real.png');

const green = greenHeartNDVI(ndviImg, BOUNDS, buildLut(RAMPS.viridis), m.ndvi.displayMin, m.ndvi.displayMax);
const heat = heatGapC(thermalImg, BOUNDS, buildLut(RAMPS.inferno), m.thermal.tminC, m.thermal.tmaxC);

console.log('Vegetation — Central Catchment mean NDVI :', green.toFixed(3));
console.log('Heat — Jurong/Tuas mean °C              :', heat.industrial.toFixed(1));
console.log('Heat — Central Catchment mean °C        :', heat.forest.toFixed(1));
console.log('Heat — gap (industrial − forest) °C     :', heat.gap.toFixed(1));
console.log('');
console.log('Paste into js/metadata.js headlines:');
console.log(`  ndvi.headline.value    = '${green.toFixed(2)}'`);
console.log(`  thermal.headline.value = '${Math.round(heat.gap)}'`);

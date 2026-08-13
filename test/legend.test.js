// Guards the NDVI legend's numeric ticks against drift: the vegetation legend must show the
// displayMin/displayMax endpoints from LAYER_META — the same range the inspector maps values into —
// so the legend ticks and click-readouts can never disagree. Pure: config.js's import chain is
// DOM-free at module top level, so it loads under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../js/config.js';
import { LAYER_META } from '../js/metadata.js';

const veg = SECTIONS.find((s) => s.id === 'vegetation');

test('vegetation legend renders a numeric NDVI tick row', () => {
  assert.match(veg.legendHTML, /class="legend-ticks"/, 'has a .legend-ticks row');
});

test('NDVI legend tick endpoints match the metadata display range', () => {
  const m = LAYER_META.ndvi;
  assert.ok(veg.legendHTML.includes(m.displayMin.toFixed(2)), `shows displayMin ${m.displayMin}`);
  assert.ok(veg.legendHTML.includes(m.displayMax.toFixed(2)), `shows displayMax ${m.displayMax}`);
});

test('NDVI legend keeps the plain-language ends alongside the numbers', () => {
  const m = LAYER_META.ndvi;
  assert.ok(veg.legendHTML.includes(m.rampEnds[0]), 'keeps the "bare" end label');
  assert.ok(veg.legendHTML.includes(m.rampEnds[1]), 'keeps the "dense canopy" end label');
});

// Unit tests for the inspector's pure sampling logic (no browser/canvas needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLut, latLngToPixel, lutIndexForRgb } from '../js/sample.js';
import { RAMPS } from '../js/ramps.js';

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('buildLut returns 256 [r,g,b] entries with endpoints matching the stops', () => {
  const stops = RAMPS.viridis;
  const lut = buildLut(stops);
  assert.equal(lut.length, 256);
  assert.ok(
    lut.every((c) => c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)),
    'every entry is an [r,g,b] byte triple'
  );
  assert.deepEqual(lut[0], hexToRgb(stops[0][1]), 'first entry == first stop colour');
  assert.deepEqual(
    lut[255],
    hexToRgb(stops[stops.length - 1][1]),
    'last entry == last stop colour'
  );
});

test('lutIndexForRgb finds an exact-colour match for every LUT entry (the inspector invariant)', () => {
  // The reverse lookup must never misread a colourised pixel: for every LUT colour, the returned
  // index's colour is byte-identical (distance 0). Robust to duplicate adjacent colours.
  for (const name of ['viridis', 'inferno']) {
    const lut = buildLut(RAMPS[name]);
    for (let k = 0; k < 256; k++) {
      const [r, g, b] = lut[k];
      const idx = lutIndexForRgb(r, g, b, lut);
      assert.deepEqual(lut[idx], [r, g, b], `${name} k=${k} -> ${idx}`);
    }
  }
});

test('latLngToPixel maps bounds corners and returns null outside the overlay', () => {
  const bounds = [
    [1.205, 103.6],
    [1.475, 104.04],
  ]; // [[south, west], [north, east]]
  const w = 100;
  const h = 100;
  // NW corner (north, west) -> top-left pixel; SE corner (south, east) -> bottom-right pixel.
  assert.deepEqual(latLngToPixel(bounds, { lat: 1.475, lng: 103.6 }, w, h), { px: 0, py: 0 });
  assert.deepEqual(latLngToPixel(bounds, { lat: 1.205, lng: 104.04 }, w, h), { px: 99, py: 99 });
  assert.equal(latLngToPixel(bounds, { lat: 2.0, lng: 103.8 }, w, h), null, 'north of bounds');
  assert.equal(latLngToPixel(bounds, { lat: 1.3, lng: 100.0 }, w, h), null, 'west of bounds');
});

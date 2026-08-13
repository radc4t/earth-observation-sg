// Unit tests for the compare chapter's pure clip geometry — the one bit of logic that isn't just
// DOM wiring. Given the divider fraction, the overlay's on-screen box and the map container box, it
// must clip NDVI to the left of the divider and thermal to the right, with no overlap and no gap.
// (The drag/keyboard/DOM behaviour is verified in-browser.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipInsetsForFraction } from '../js/compare.js';

// Overlay exactly filling a 1000px container starting at x=0 (the simple aligned case).
const container = { left: 0, width: 1000 };
const img = { left: 0, right: 1000, width: 1000 };

test('the two insets always sum to the overlay width (no overlap, no gap)', () => {
  for (const f of [0, 0.25, 0.5, 0.55, 0.8, 1]) {
    const { ndviRight, thermalLeft } = clipInsetsForFraction(f, img, container);
    assert.equal(ndviRight + thermalLeft, img.width, `f=${f}`);
  }
});

test('divider fraction maps to the split position', () => {
  const mid = clipInsetsForFraction(0.5, img, container);
  assert.equal(mid.thermalLeft, 500); // thermal hidden left of centre
  assert.equal(mid.ndviRight, 500); // NDVI hidden right of centre
  const near = clipInsetsForFraction(0.8, img, container);
  assert.equal(near.thermalLeft, 800);
  assert.equal(near.ndviRight, 200);
});

test('insets clamp to [0, width] at the extremes', () => {
  const left = clipInsetsForFraction(0, img, container);
  assert.deepEqual(left, { ndviRight: 1000, thermalLeft: 0 }); // all NDVI hidden -> pure thermal
  const right = clipInsetsForFraction(1, img, container);
  assert.deepEqual(right, { ndviRight: 0, thermalLeft: 1000 }); // all thermal hidden -> pure NDVI
});

test('handles an overlay offset from the container origin (e.g. panned/zoomed frame)', () => {
  // Overlay wider than the container and shifted left: left edge at -200, right edge at 1200.
  const wide = { left: -200, right: 1200, width: 1400 };
  const { ndviRight, thermalLeft } = clipInsetsForFraction(0.5, wide, { left: 0, width: 1000 });
  // divider screen x = 500 → thermal hides from its left edge (-200) to 500 = 700; NDVI hides from
  // 500 to its right edge (1200) = 700. Sum = overlay width (1400).
  assert.equal(thermalLeft, 700);
  assert.equal(ndviRight, 700);
  assert.equal(ndviRight + thermalLeft, wide.width);
});

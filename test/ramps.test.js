// The colour ramps are a single source of truth (JS + Python read the same stops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAMPS, rampGradientCss } from '../js/ramps.js';

test('viridis / inferno are ascending [pos, "#hex"] stops within [0,1]', () => {
  for (const name of ['viridis', 'inferno']) {
    const stops = RAMPS[name];
    assert.ok(Array.isArray(stops) && stops.length >= 2, `${name} has >= 2 stops`);
    let prev = -Infinity;
    for (const [pos, hex] of stops) {
      assert.ok(pos >= 0 && pos <= 1, `${name} position ${pos} in [0,1]`);
      assert.ok(pos >= prev, `${name} positions ascending`);
      assert.match(hex, /^#[0-9a-fA-F]{6}$/, `${name} valid hex ${hex}`);
      prev = pos;
    }
  }
});

test('rampGradientCss builds a linear-gradient from the stops', () => {
  const css = rampGradientCss(RAMPS.viridis);
  assert.match(css, /^linear-gradient\(/);
  assert.ok(css.includes(RAMPS.viridis[0][1]), 'includes the first stop colour');
});

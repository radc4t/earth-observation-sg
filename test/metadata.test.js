// Provenance invariants: metadata is the single source, and the Methods chapter renders the
// intended content (honest, decluttered) — asserted by presence, not by absence of wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_META, methodsHTML } from '../js/metadata.js';

test('LAYER_META: real layers carry provenance, thermal range ordered, maritime illustrative', () => {
  for (const k of ['ndvi', 'thermal', 'maritime']) assert.ok(LAYER_META[k], `${k} present`);
  for (const k of ['ndvi', 'thermal']) {
    const m = LAYER_META[k];
    assert.equal(m.real, true, `${k} is real`);
    for (const f of ['title', 'source', 'date', 'sourceResolution', 'displayResolution']) {
      assert.ok(m[f], `${k}.${f} present`);
    }
  }
  assert.ok(LAYER_META.thermal.tminC < LAYER_META.thermal.tmaxC, 'thermal tminC < tmaxC');
  const mar = LAYER_META.maritime;
  assert.equal(mar.real, false, 'maritime is illustrative');
  assert.ok(mar.illustrationNote && mar.realSource, 'maritime has illustrationNote + realSource');
});

test('methodsHTML: intended provenance content present, no pill chrome', () => {
  const html = methodsHTML();
  // The REAL / ILLUSTRATION pills were deliberately removed — no pill markup should remain.
  assert.ok(!html.includes('legend-badge'), 'no legend-badge pill markup');
  // The maritime row stays honestly labelled as simulated (the descriptor the owner kept).
  assert.ok(html.includes('Simulated'), 'maritime row says "Simulated"');
  // Each real layer names its source (Sentinel-2, Landsat).
  assert.ok(html.includes(LAYER_META.ndvi.source), 'NDVI source named');
  assert.ok(html.includes(LAYER_META.thermal.source), 'thermal source named');
});

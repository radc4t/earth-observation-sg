// Enforces the M1 contract: the CSS motion tokens in style.css MIRROR js/motion.js so the two
// (kept in sync by hand) can't silently drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION } from '../js/motion.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(dir, '..', 'css/style.css'), 'utf8');

function cssTokenMs(name) {
  const m = css.match(new RegExp(`--${name}:\\s*([0-9.]+)ms`));
  assert.ok(m, `css --${name} present`);
  return parseFloat(m[1]);
}

test('MOTION durations are positive numbers', () => {
  for (const k of ['durMicro', 'durComponent', 'durPanel', 'delayNarrative']) {
    assert.ok(typeof MOTION[k] === 'number' && MOTION[k] > 0, `${k} is a positive number`);
  }
});

test('CSS motion tokens mirror js/motion.js', () => {
  assert.equal(cssTokenMs('dur-micro'), MOTION.durMicro);
  assert.equal(cssTokenMs('dur-component'), MOTION.durComponent);
  assert.equal(cssTokenMs('dur-panel'), MOTION.durPanel);
  assert.equal(cssTokenMs('delay-narrative'), MOTION.delayNarrative);
});

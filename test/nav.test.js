// Unit tests for the chapter-nav's pure scroll-progress math (no browser/DOM needed).
// The rail's DOM wiring + click-to-jump behaviour is verified in-browser; here we pin the one
// piece of pure logic so a regression in the progress-bar maths fails CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// nav.js transitively imports state.js, which reads window.matchMedia at module load. Provide a
// minimal shim so the module can be imported in a plain Node context, then dynamic-import it.
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const { scrollProgress } = await import('../js/nav.js');

test('scrollProgress is 0 at the top and 1 at the bottom', () => {
  assert.equal(scrollProgress(0, 5000, 1000), 0);
  assert.equal(scrollProgress(4000, 5000, 1000), 1); // 5000 - 1000 viewport = 4000 scrollable
});

test('scrollProgress reports the fraction scrolled at the midpoint', () => {
  assert.equal(scrollProgress(2000, 5000, 1000), 0.5);
});

test('scrollProgress is 0 for an unscrollable page (content <= viewport)', () => {
  assert.equal(scrollProgress(0, 800, 1000), 0); // content shorter than the viewport
  assert.equal(scrollProgress(0, 1000, 1000), 0); // exactly the viewport height
});

test('scrollProgress clamps rubber-band / momentum overscroll into [0, 1]', () => {
  assert.equal(scrollProgress(-50, 5000, 1000), 0); // overscroll above the top
  assert.equal(scrollProgress(99999, 5000, 1000), 1); // momentum past the bottom
});

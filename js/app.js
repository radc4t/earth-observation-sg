// app.js — entry point. Wires the map, story, overlays, inspect tool and small UI bits.
// This was previously an inline <script type="module"> in index.html; it lives in a file
// so esbuild can use it as the bundle entry (and so the dev build stays native-ESM).

import { createMap, registerBasemapToggle, registerOverlays, onLayerError } from './map.js';
import { SECTIONS } from './config.js';
import { initScrolly } from './scrolly.js';
import { initNav } from './nav.js';
import { methodsHTML, statHTML } from './metadata.js';
import { initInspect } from './inspect.js';
import { registerThemeToggle } from './theme.js';
import { initMobile } from './mobile.js';
import { RAMPS, rampGradientCss } from './ramps.js';
import { ndviLayer } from './layers/ndvi.js';
import { thermalLayer } from './layers/thermal.js';
import { icon } from './icons.js';

// Populate the Methods chapter's per-layer provenance rows from the single metadata source.
document.getElementById('methods-body').innerHTML = methodsHTML();

// Fill each chapter's headline-stat placeholder with its derived figure (js/metadata.js → statHTML).
document.querySelectorAll('[data-stat]').forEach((el) => {
  el.innerHTML = statHTML(el.dataset.stat);
});

const map = createMap('map');
const modules = [
  ...new Set(SECTIONS.map((s) => s.layerConfig && s.layerConfig.module).filter(Boolean)),
];

registerOverlays(map, modules);
registerBasemapToggle(map, document.getElementById('basemap-toggle'));
registerThemeToggle(document.getElementById('theme-toggle'));
// Click the map to read the NDVI / temperature value under the cursor. Created before the story
// so the story can raise its "raster visible" signal to gate the inspect affordance.
const inspect = initInspect(map, { ndvi: ndviLayer, thermal: thermalLayer });
// The hero step activates on load and flies from the wide intro framing (zoom 9)
// down to the whole island (zoom 11) — a cinematic zoom-in. The overlay develops in on the
// glide's tail and only then does the inspect affordance appear (onRasterVisible).
const story = initScrolly(map, SECTIONS, {
  onLayerError,
  onRasterVisible: inspect.setRasterVisible,
});
// Mobile bottom-sheet "Explore map" behaviour (no-op on desktop).
initMobile(map);

// Field-report card swatches: tint each real chapter's date-stamp chip with its own overlay
// ramp (keyed by section id, not DOM order) so overlay, legend and card all share one source.
// Maritime's flat ochre illustration chip is set in CSS.
const paintStampSwatch = (sectionId, stops) => {
  const el = document.querySelector(`.step[data-id="${sectionId}"] .datatag .swatch`);
  if (el) el.style.background = rampGradientCss(stops);
};
paintStampSwatch('vegetation', RAMPS.viridis);
paintStampSwatch('heat', RAMPS.inferno);
// Expose for deep-linking (#section in URL) and debugging.
window.__map = map;
window.__story = story;
if (location.hash) {
  // A deep-link's scroll must win over the browser's automatic scroll restoration,
  // which otherwise fires after load and clobbers jumpTo (a fresh visit works, but a
  // reload / return-nav would land at the restored position, not the hash target).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  story.jumpTo(location.hash.slice(1));
}

// Chapter-nav rail + scroll-progress bar. Initialised AFTER the load-time deep-link above so the
// rail's URL-hash sync can never clobber location.hash before jumpTo has consumed it.
initNav(SECTIONS);

// Live deep-linking: honour hash changes AFTER load too (a pasted/edited URL, or a shared link
// opened in an already-open tab). nav.js only ever updates the hash via history.replaceState, which
// does NOT fire 'hashchange', so this reacts solely to genuine user navigation — no feedback loop.
// Unknown ids (e.g. the "#story" skip-link) are a no-op: jumpTo() bails when the id isn't a section.
window.addEventListener('hashchange', () => {
  if (location.hash) story.jumpTo(location.hash.slice(1));
});

// Icons for the static-HTML controls (decorative Lucide glyphs; the control's text / aria-label
// carries the accessible name). Injected once at init — a failed lookup degrades to text.
function initIcons() {
  const closeBtn = document.querySelector('.inspect-sheet-close');
  if (closeBtn) closeBtn.innerHTML = icon('x'); // aria-label="Close reading" stays on the button

  // The "read a value" hint gets a real crosshair reticle (the old bespoke "+" read as add/zoom).
  const rt = document.querySelector('.inspect-hint .rt');
  if (rt) rt.innerHTML = icon('crosshair');

  // Legend collapse + the Methods <details> disclosure share one chevron; its direction is driven
  // by CSS from aria-expanded / [open], so nothing here (or later) rotates the SVG.
  const lc = document.getElementById('legend-collapse');
  if (lc) lc.insertAdjacentHTML('beforeend', icon('chevron-down'));
  const summary = document.querySelector('.about summary');
  if (summary) summary.insertAdjacentHTML('afterbegin', icon('chevron-down'));

  // External links get an "opens in new tab" arrow (decorative) + a visually-hidden phrase so the
  // accessible name reads cleanly, e.g. "EOX IT Services GmbH, opens in new tab".
  document.querySelectorAll('.about-body a[target="_blank"]').forEach((a) => {
    if (a.dataset.iconified) return; // append once
    a.dataset.iconified = '1';
    a.insertAdjacentHTML(
      'beforeend',
      icon('arrow-up-right') + '<span class="sr-only"> (opens in new tab)</span>'
    );
  });
}
initIcons();

// Legend collapse (mobile-friendly). Toggles [hidden] on the legend body and aria-expanded on the
// button; the chevron direction follows aria-expanded via CSS (no text/glyph juggling).
const collapseBtn = document.getElementById('legend-collapse');
const legendBody = document.getElementById('legend');
collapseBtn.addEventListener('click', () => {
  const collapsed = legendBody.hasAttribute('hidden');
  if (collapsed) legendBody.removeAttribute('hidden');
  else legendBody.setAttribute('hidden', '');
  collapseBtn.setAttribute('aria-expanded', String(collapsed));
});

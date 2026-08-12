// app.js — entry point. Wires the map, story, overlays, inspect tool and small UI bits.
// This was previously an inline <script type="module"> in index.html; it lives in a file
// so esbuild can use it as the bundle entry (and so the dev build stays native-ESM).

import { createMap, registerBasemapToggle, registerOverlays, onLayerError } from './map.js';
import { SECTIONS } from './config.js';
import { initScrolly } from './scrolly.js';
import { methodsHTML } from './metadata.js';
import { initInspect } from './inspect.js';
import { registerThemeToggle } from './theme.js';
import { RAMPS, rampGradientCss } from './ramps.js';
import { ndviLayer } from './layers/ndvi.js';
import { thermalLayer } from './layers/thermal.js';

// Populate the Methods chapter's per-layer provenance rows from the single metadata source.
document.getElementById('methods-body').innerHTML = methodsHTML();

const map = createMap('map');
const modules = [
  ...new Set(SECTIONS.map((s) => s.layerConfig && s.layerConfig.module).filter(Boolean)),
];

registerOverlays(map, modules);
registerBasemapToggle(map, document.getElementById('basemap-toggle'));
registerThemeToggle(document.getElementById('theme-toggle'));
// The hero step activates on load and flies from the wide intro framing (zoom 9)
// down to the whole island (zoom 11) — a cinematic zoom-in.
const story = initScrolly(map, SECTIONS, { onLayerError });
// Click the map to read the NDVI / temperature value under the cursor.
initInspect(map, { ndvi: ndviLayer, thermal: thermalLayer });

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
if (location.hash) story.jumpTo(location.hash.slice(1));

// Legend collapse (mobile-friendly)
const collapseBtn = document.getElementById('legend-collapse');
const legendBody = document.getElementById('legend');
collapseBtn.addEventListener('click', () => {
  const open = legendBody.hasAttribute('hidden');
  if (open) {
    legendBody.removeAttribute('hidden');
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.textContent = 'Legend ▾';
  } else {
    legendBody.setAttribute('hidden', '');
    collapseBtn.setAttribute('aria-expanded', 'false');
    collapseBtn.textContent = 'Legend ▸';
  }
});

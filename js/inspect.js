// inspect.js — read the actual data value under a point, as an editorial "field measurement".
//
// One interaction path (inspectAt) serves both mouse and keyboard:
//   mouse click  → sample the clicked point
//   Enter / R    → sample the map centre (keyboard, when #map is focused)
// For each inspectable raster overlay currently visible (per central state), ask its layer
// module for the value at that lat/lng (js/sample.js reverse-lookup — unchanged) and show one
// Leaflet popup with an editorial readout (big value + unit, label, the coordinate read) plus a
// concise aria-live announcement. If no inspectable overlay is active (hero/maritime/outro),
// the affordance is hidden and any stale readout is closed.

import { state, subscribe } from './state.js';
import { LAYER_META } from './metadata.js';

const INSPECTABLE = ['ndvi', 'thermal'];

function fmtCoord(latlng) {
  const ns = latlng.lat >= 0 ? 'N' : 'S';
  const ew = latlng.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(latlng.lat).toFixed(3)}°${ns} ${Math.abs(latlng.lng).toFixed(3)}°${ew}`;
}

// inspectables: { ndvi: ndviLayer, thermal: thermalLayer } — modules exposing inspect().
export function initInspect(map, inspectables) {
  const liveEl = document.getElementById('inspect-live');
  const hintEl = document.getElementById('inspect-hint');
  const mapEl = map.getContainer();

  const activeKeys = () => Object.keys(inspectables).filter((k) => state.overlays[k]);

  function readoutRow(k, res, latlng) {
    const m = LAYER_META[k];
    const coord = fmtCoord(latlng);
    if (!res || res.masked) {
      return (
        `<div class="ro-row"><div class="ro-lab">${m.title}</div>` +
        `<div class="ro-none">No reading here — cloud / water / edge</div>` +
        `<div class="ro-sub"><span class="ro-co">${coord}</span></div></div>`
      );
    }
    const unit = (res.unit || '').trim();
    const cls = res.cls ? ` · ${res.cls}` : '';
    return (
      `<div class="ro-row">` +
      `<div class="ro-big">${res.value}${unit ? `<span class="ro-unit">${unit}</span>` : ''}</div>` +
      `<div class="ro-lab">${m.title}${cls}</div>` +
      `<div class="ro-sub"><span class="ro-co">${coord}</span><span>${m.source} · ${m.date}</span></div>` +
      `</div>`
    );
  }

  // A concise spoken reading for the aria-live region (not the whole popup DOM).
  function announce(k, res, latlng) {
    if (!liveEl) return;
    const m = LAYER_META[k];
    const coord = fmtCoord(latlng);
    if (!res || res.masked) {
      liveEl.textContent = `${m.title}: no reading here at ${coord}.`;
      return;
    }
    const unit = (res.unit || '').trim();
    const cls = res.cls ? `, ${res.cls}` : '';
    liveEl.textContent = `${m.title}: ${res.value}${unit ? ' ' + unit : ''}${cls}, at ${coord}.`;
  }

  // The single interaction path for both mouse and keyboard.
  function inspectAt(latlng) {
    const keys = activeKeys();
    if (keys.length === 0) return; // nothing readable here — stay silent
    const results = keys.map((k) => ({ k, res: inspectables[k].inspect(latlng) }));
    L.popup({ offset: [0, -2], className: 'inspect-popup' })
      .setLatLng(latlng)
      .setContent(
        `<div class="inspect-readout">${results.map(({ k, res }) => readoutRow(k, res, latlng)).join('')}</div>`
      )
      .openOn(map);
    announce(results[0].k, results[0].res, latlng); // one overlay is active at a time
  }

  map.on('click', (e) => inspectAt(e.latlng));

  // Keyboard: Enter (primary) / R (optional) sample the map CENTRE. Only these two keys are
  // handled and preventDefault'd, so Leaflet keeps its own arrow-pan / +- zoom behaviour.
  mapEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'r' && e.key !== 'R') return;
    if (activeKeys().length === 0) return;
    e.preventDefault();
    inspectAt(map.getCenter());
  });

  // State-driven affordance + stale-readout cleanup. When no inspectable layer is active
  // (hero/maritime/outro, and across section changes), hide the hint/cursor, close any open
  // readout, and clear the live region so a stale reading is never left hanging.
  function reflect(s) {
    const inspectable = INSPECTABLE.some((k) => s.overlays[k]);
    mapEl.classList.toggle('is-inspectable', inspectable);
    if (hintEl) hintEl.classList.toggle('is-shown', inspectable);
    if (!inspectable) {
      map.closePopup();
      if (liveEl) liveEl.textContent = '';
    }
  }
  subscribe(reflect);
  reflect(state);
}

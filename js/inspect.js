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
// A finger drag that ends on the map must not read a value — only a genuine tap. Tunable;
// validate on the real 375px experience.
const TAP_MOVE_THRESHOLD_PX = 10;
const mobileMQ = window.matchMedia('(max-width: 760px)');

function fmtCoord(latlng) {
  const ns = latlng.lat >= 0 ? 'N' : 'S';
  const ew = latlng.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(latlng.lat).toFixed(3)}°${ns} ${Math.abs(latlng.lng).toFixed(3)}°${ew}`;
}

// inspectables: { ndvi: ndviLayer, thermal: thermalLayer } — modules exposing inspect().
export function initInspect(map, inspectables) {
  const liveEl = document.getElementById('inspect-live');
  const hintEl = document.getElementById('inspect-hint');
  const sheetEl = document.getElementById('inspect-sheet');
  const sheetBody = sheetEl && sheetEl.querySelector('.inspect-sheet-body');
  const mapEl = map.getContainer();

  const activeKeys = () => Object.keys(inspectables).filter((k) => state.overlays[k]);

  // Close whichever renderer is open (desktop popup and/or the mobile sheet).
  function closeReadout() {
    map.closePopup();
    if (sheetEl) {
      sheetEl.classList.remove('is-shown');
      sheetEl.hidden = true;
    }
  }

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

  // The single interaction path for both mouse and keyboard. Same readoutRow() content on both
  // platforms — mobile renders it into the bottom sheet, desktop into the anchored Leaflet popup.
  function inspectAt(latlng) {
    const keys = activeKeys();
    if (keys.length === 0) return; // nothing readable here — stay silent
    const results = keys.map((k) => ({ k, res: inspectables[k].inspect(latlng) }));
    const rowsHtml = results.map(({ k, res }) => readoutRow(k, res, latlng)).join('');
    if (mobileMQ.matches && sheetEl && sheetBody) {
      sheetBody.innerHTML = rowsHtml; // sheetBody already carries the .inspect-readout class
      sheetEl.hidden = false;
      // Force a reflow so the hidden (translated-down) state is committed, then reveal — the
      // slide-up transitions reliably without depending on requestAnimationFrame timing.
      void sheetEl.offsetHeight;
      sheetEl.classList.add('is-shown');
    } else {
      L.popup({ offset: [0, -2], className: 'inspect-popup' })
        .setLatLng(latlng)
        .setContent(`<div class="inspect-readout">${rowsHtml}</div>`)
        .openOn(map);
    }
    announce(results[0].k, results[0].res, latlng); // one overlay is active at a time
  }

  // Scroll-vs-tap: a drag that ends on the map (scrolling the story, or panning) must not read a
  // value. Track touch movement and skip the resulting click when it exceeds the threshold.
  let touchStart = null;
  let touchMoved = 0;
  mapEl.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
      touchMoved = 0;
    },
    { passive: true }
  );
  mapEl.addEventListener(
    'touchmove',
    (e) => {
      if (!touchStart) return;
      const t = e.touches[0];
      touchMoved = Math.max(
        touchMoved,
        Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y)
      );
    },
    { passive: true }
  );
  map.on('click', (e) => {
    if (touchMoved > TAP_MOVE_THRESHOLD_PX) {
      touchMoved = 0;
      return; // a scroll/pan gesture, not a tap
    }
    inspectAt(e.latlng);
  });

  // Mobile sheet close button — dismisses the reading only; it does NOT change the Explore state
  // (that state is owned by mobile.js), so the reader stays in explore mode over the map.
  if (sheetEl) {
    const closeBtn = sheetEl.querySelector('.inspect-sheet-close');
    if (closeBtn) closeBtn.addEventListener('click', closeReadout);
  }

  // Breakpoint safety: if the viewport crosses 760px while a reading is open, close the current
  // renderer rather than migrating it live. Only closes the readout — never touches map-explore.
  mobileMQ.addEventListener('change', () => {
    closeReadout();
    if (liveEl) liveEl.textContent = '';
  });

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
      closeReadout();
      if (liveEl) liveEl.textContent = '';
    }
  }
  subscribe(reflect);
  reflect(state);
}

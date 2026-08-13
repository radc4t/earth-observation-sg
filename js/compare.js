// compare.js — the "two views, one island" swipe chapter.
//
// Shows the NDVI and thermal overlays over the SAME frozen frame, split by a draggable vertical
// divider, so the reader can see the correlation the outro asserts: the forested green heart is the
// cool centre, the built/industrial west is both less green and hotter. Both overlays are
// L.imageOverlay at the same BOUNDS/pane (js/layers/{ndvi,thermal}.js), already mounted at opacity 0
// — enter() reveals both and clips each to its half; exit() restores everything.
//
// A self-contained controller (à la js/mobile.js): the scrolly engine calls enter()/exit() from the
// compare section's choreography slot. The camera is frozen while active, so the clip is a plain
// screen-space split with no pan-sync math.

// Pure: given the divider fraction (0..1), the overlay image's on-screen box and the map container
// box, return how many px to clip off each overlay so NDVI shows LEFT of the divider and thermal
// RIGHT, with no overlap. Both overlays share one rect (same bounds/pane). Exported for unit tests.
export function clipInsetsForFraction(fraction, imgRect, containerRect) {
  const dividerX = containerRect.left + fraction * containerRect.width;
  const clamp = (v) => Math.max(0, Math.min(imgRect.width, v));
  return {
    ndviRight: clamp(imgRect.right - dividerX), // hide NDVI to the right of the divider
    thermalLeft: clamp(dividerX - imgRect.left), // hide thermal to the left of the divider
  };
}

const DEFAULT_FRACTION = 0.55;
const STEP = 0.02;

export function initCompare(map, { ndviLayer, thermalLayer }) {
  let fraction = DEFAULT_FRACTION;
  let active = false;
  let divider = null;
  let handle = null;
  // Map-interaction state captured on enter so exit restores it (never clobbers mobile.js's model).
  let saved = null;

  const imgEl = (layer) => layer._layer && layer._layer.getElement();

  function buildDivider() {
    divider = document.createElement('div');
    divider.className = 'compare-divider';
    divider.innerHTML =
      '<span class="compare-tag compare-tag--left" aria-hidden="true">Green</span>' +
      '<span class="compare-tag compare-tag--right" aria-hidden="true">Heat</span>' +
      '<div class="compare-divider-line" aria-hidden="true"></div>' +
      '<button class="compare-handle" type="button" role="slider" tabindex="0"' +
      ' aria-label="Reveal green cover versus surface heat" aria-orientation="horizontal"' +
      ' aria-valuemin="0" aria-valuemax="100">' +
      '<span class="compare-handle-grip" aria-hidden="true"></span></button>';
    handle = divider.querySelector('.compare-handle');

    // Pointer drag (mouse + touch via Pointer Events).
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = map.getContainer().getBoundingClientRect();
        setFraction((ev.clientX - r.left) / r.width);
      };
      const up = (ev) => {
        handle.releasePointerCapture(e.pointerId);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        void ev;
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });

    // Keyboard: it's an ARIA slider.
    handle.addEventListener('keydown', (e) => {
      let f = fraction;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') f -= STEP;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') f += STEP;
      else if (e.key === 'Home') f = 0.05;
      else if (e.key === 'End') f = 0.95;
      else return;
      e.preventDefault();
      setFraction(f);
    });

    map.getContainer().appendChild(divider);
  }

  function setFraction(f) {
    fraction = Math.max(0.05, Math.min(0.95, f));
    render();
  }

  // Position the divider and clip both overlays to their half. Cheap + idempotent — safe to call on
  // drag, on map settle, and on resize. Gated on `active` so any stray late call is a no-op.
  function render() {
    if (!active || !divider) return;
    const ndvi = imgEl(ndviLayer);
    const thermal = imgEl(thermalLayer);
    if (!ndvi || !thermal) return;
    const container = map.getContainer().getBoundingClientRect();
    const rect = ndvi.getBoundingClientRect(); // both overlays share one screen box
    const { ndviRight, thermalLeft } = clipInsetsForFraction(fraction, rect, container);
    ndvi.style.clipPath = `inset(0 ${ndviRight}px 0 0)`;
    thermal.style.clipPath = `inset(0 0 0 ${thermalLeft}px)`;
    divider.style.left = `${fraction * 100}%`;
    if (handle) handle.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  }

  // Persistent safety net: any map settle (the setView from a deep-link / adjacent section) or a
  // viewport resize re-asserts the clip. Guarded by `active`, so it's inert outside compare — this
  // is what makes the split robust against the on-load activate/observer race (a transient
  // exit→enter could otherwise leave the overlays unclipped).
  map.on('moveend resize zoomend', render);
  window.addEventListener('resize', render);

  function enter() {
    if (!divider) buildDivider();
    // Both overlays visible; each clipped to its half (no blended overlap).
    ndviLayer.setVisible(map, true);
    thermalLayer.setVisible(map, true);
    if (!active) {
      // Freeze the camera so the screen-space split stays put; capture prior state to restore.
      saved = {
        dragging: map.dragging.enabled(),
        touchZoom: map.touchZoom.enabled(),
        keyboard: map.keyboard.enabled(),
      };
      map.dragging.disable();
      map.touchZoom.disable();
      map.keyboard.disable(); // arrow keys drive the divider slider, not a map pan
      fraction = DEFAULT_FRACTION;
      active = true;
    }
    // Apply now (synchronously, so the final enter always paints), next frame (after Leaflet lays
    // the overlays out) and once more after settle — belt-and-suspenders against the load race.
    render();
    requestAnimationFrame(render);
    setTimeout(render, 150);
  }

  function exit() {
    if (!active) return;
    active = false;
    // Clear the clip so a later single-overlay chapter isn't left half-hidden. (Overlay hiding
    // itself is handled by the engine's hideAllOverlays on the next section.)
    const ndvi = imgEl(ndviLayer);
    const thermal = imgEl(thermalLayer);
    if (ndvi) ndvi.style.clipPath = '';
    if (thermal) thermal.style.clipPath = '';
    if (saved) {
      if (saved.dragging) map.dragging.enable();
      if (saved.touchZoom) map.touchZoom.enable();
      if (saved.keyboard) map.keyboard.enable();
      saved = null;
    }
  }

  return { enter, exit };
}

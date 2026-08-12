// mobile.js — the mobile bottom-sheet "Explore map" behaviour. This module is the SINGLE owner
// of the `body.map-explore` state; every other module (CSS, inspect.js) only reacts to it.
//
// States: normal (map + story sheet) · explore (map + story peek) · explore+read (map + reading
// sheet). A section change always resets to normal. All of this is gated to mobile via
// matchMedia and is a no-op on desktop — the scrollytelling engine (scrolly.js) is untouched;
// the reset is a plain state subscriber.

import { subscribe } from './state.js';

const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

function setExplore(on) {
  document.body.classList.toggle('map-explore', on);
  // Keep every injected handle's label + accessible name in step with the state.
  document.querySelectorAll('.card-handle').forEach((h) => {
    const label = h.querySelector('.card-handle-label');
    if (label) label.textContent = on ? 'Show the story' : 'Explore map';
    h.setAttribute('aria-label', on ? 'Show the story' : 'Show the full map');
    h.setAttribute('aria-pressed', String(on));
  });
}

export function initMobile(map) {
  // Inject a sticky grab handle into every card (once). Hidden on desktop via CSS, so this is
  // safe to do regardless of the current width (survives a resize into mobile).
  document.querySelectorAll('.card').forEach((card) => {
    if (card.querySelector('.card-handle')) return;
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'card-handle';
    handle.innerHTML =
      '<span class="card-handle-grip" aria-hidden="true"></span>' +
      '<span class="card-handle-label">Explore map</span>';
    handle.addEventListener('click', () =>
      setExplore(!document.body.classList.contains('map-explore'))
    );
    card.prepend(handle);
  });
  setExplore(false);

  // Default-collapse the legend on mobile — a compact top-right pill the reader can expand,
  // rather than an always-open panel competing with the bottom sheet. Set the state directly
  // (mirrors the collapse control in app.js) so it doesn't depend on handler-wiring order.
  if (isMobile()) {
    const legendBody = document.getElementById('legend');
    const collapseBtn = document.getElementById('legend-collapse');
    if (legendBody && collapseBtn && !legendBody.hasAttribute('hidden')) {
      legendBody.setAttribute('hidden', '');
      collapseBtn.setAttribute('aria-expanded', 'false');
      collapseBtn.textContent = 'Legend ▸';
    }
  }

  // The touch model: normal = map is a static backdrop (a drag scrolls the story, a tap reads a
  // value); explore = the reader can pan/zoom the map. Toggle Leaflet's drag/zoom handlers with
  // the state — an interaction-config change only, never the flyTo/observer engine. Desktop keeps
  // its own defaults untouched.
  const applyTouchModel = () => {
    if (!isMobile()) return;
    const explore = document.body.classList.contains('map-explore');
    if (explore) {
      map.dragging.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
    }
  };

  // Re-apply the touch model after every state change (explore toggled or section reset).
  const observer = new MutationObserver(applyTouchModel);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // A section change always resets to normal (restores the story sheet, closes any peek). This
  // is the only coupling to the story — a state subscriber, not a scrolly.js edit.
  let lastSection = null;
  subscribe((s) => {
    if (s.section !== lastSection) {
      lastSection = s.section;
      if (document.body.classList.contains('map-explore')) setExplore(false);
    }
  });

  // Keep the touch model correct across breakpoint changes (e.g. desktop → mobile).
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => {
    if (!isMobile()) {
      // Back on desktop: drop explore state and restore the default map interactions.
      setExplore(false);
      map.dragging.enable();
      map.touchZoom.enable();
    } else {
      applyTouchModel();
    }
  });

  applyTouchModel();
}

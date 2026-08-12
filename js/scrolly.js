// scrolly.js — scroll-driven storytelling. As each step card enters the viewport,
// fly the camera, toggle the right overlay, and swap the legend. Overlapping flyTo
// calls from fast scrolling are collapsed to the latest target via an isFlying guard.

import { setState } from './state.js';
import { MOTION } from './motion.js';

// Evidence, then interpretation: the map transforms first (camera + overlay), then
// after a brief beat the story card rises. From the shared motion vocabulary so the beat
// matches the other component timings. Set to 0 under reduced motion (card appears with all else).
const CARD_REVEAL_DELAY_MS = MOTION.delayNarrative;

export function initScrolly(map, sections, opts = {}) {
  const legendEl = opts.legendEl || document.getElementById('legend');
  const legendWrap = opts.legendWrap || document.getElementById('legend-panel');

  const byId = new Map(sections.map((s) => [s.id, s]));
  const modules = [
    ...new Set(sections.map((s) => s.layerConfig && s.layerConfig.module).filter(Boolean)),
  ];

  let activeId = null;
  let desired = null; // latest requested section
  let flownId = null; // section we last launched a flyTo toward
  let isFlying = false;
  let revealTimer = null; // pending card-reveal; cleared if a newer section activates first

  function hideAllOverlays() {
    modules.forEach((m) => m.setVisible(map, false));
  }

  function applyLayers(section) {
    hideAllOverlays();
    const overlays = { ndvi: false, thermal: false, maritime: false };
    if (section.layerConfig && section.layerConfig.module) {
      const mod = section.layerConfig.module;
      mod.setVisible(map, true);
      if (mod.key) overlays[mod.key] = true;
    }
    setState({ overlays });
  }

  let legendClearTimer = null;
  function updateLegend(section) {
    if (!legendEl) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (legendClearTimer) {
      clearTimeout(legendClearTimer);
      legendClearTimer = null;
    }
    if (section.legendHTML) {
      const swapping =
        legendWrap && legendWrap.classList.contains('is-shown') && legendEl.innerHTML;
      if (swapping && !reduced) {
        // Already visible with different content: dip the content out, swap, fade back in,
        // so the key cross-fades rather than snapping to the new section's legend.
        legendEl.classList.add('is-swapping');
        // 160ms = the one-off legend "swap dip" (matches the .legend transition in style.css).
        // A local implementation detail, intentionally not a shared motion token.
        legendClearTimer = setTimeout(() => {
          legendEl.innerHTML = section.legendHTML;
          legendEl.classList.remove('is-swapping');
          legendClearTimer = null;
        }, 160);
      } else {
        legendEl.innerHTML = section.legendHTML;
        legendEl.classList.remove('is-swapping');
      }
      if (legendWrap) legendWrap.classList.add('is-shown'); // panel fades in via CSS
    } else if (legendWrap) {
      legendWrap.classList.remove('is-shown'); // panel fades out via CSS
      // Clear the content only after the fade so it doesn't blank abruptly.
      const clear = () => {
        if (!legendWrap.classList.contains('is-shown')) legendEl.innerHTML = '';
        legendClearTimer = null;
      };
      // 350ms = local "clear after the panel has faded out" delay (must stay >= the panel
      // fade so content doesn't blank early); a one-off, not a shared motion token.
      if (reduced) clear();
      else legendClearTimer = setTimeout(clear, 350);
    }
  }

  function scheduleFly() {
    if (isFlying || !desired) return; // in-flight → handled on moveend
    const s = desired;
    flownId = s.id;
    isFlying = true;
    const cur = map.getCenter();
    const size = map.getSize();
    const [lat, lng] = s.camera.center;
    // Guards: (a) an identical start/target centre makes Leaflet's flyTo divide by zero
    // (NaN LatLng); (b) a zero-size / not-yet-laid-out map yields NaN in the animation;
    // (c) the reader asked for reduced motion. In each case jump instantly, no animation.
    const sameCentre = Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6;
    const notReady =
      !size ||
      size.x === 0 ||
      size.y === 0 ||
      !Number.isFinite(cur.lat) ||
      !Number.isFinite(cur.lng);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sameCentre || notReady || reducedMotion) {
      map.setView(s.camera.center, s.camera.zoom, { animate: false });
    } else {
      map.flyTo(s.camera.center, s.camera.zoom, {
        duration: s.camera.duration || 2,
        easeLinearity: MOTION.easeLinearity,
      });
    }
  }

  map.on('moveend', () => {
    if (!isFlying) return;
    isFlying = false;
    if (desired && desired.id !== flownId) scheduleFly(); // a newer target arrived mid-flight
  });

  function activate(section) {
    if (!section || section.id === activeId) return;
    activeId = section.id;
    desired = section;
    map.closePopup(); // dismiss any inspect / vessel popup from the previous section
    setState({ section: section.id });

    // The map transforms first — overlay, legend and camera all dispatch now — so the reader
    // sees the evidence change before the story card interprets it. The basemap is the
    // reader's choice and is intentionally left unchanged across sections.
    applyLayers(section);
    updateLegend(section);
    scheduleFly();

    // Methods dims the map to a paper ground. This is the ONLY Methods-specific behaviour —
    // overlays/legend/inspector are already off via the engine's null-layer state above. The
    // class flips off on every other section, so the wash never lingers.
    document.body.classList.toggle('methods-active', section.kind === 'methods');

    // Then the card rises, a beat later. Clear any pending reveal so fast scrolling can't
    // fire a stale section's card over the current one.
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    document.querySelectorAll('.step').forEach((el) => el.classList.remove('is-active'));
    const revealCard = () => {
      document.querySelectorAll('.step').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.id === section.id);
      });
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Hero reveals immediately (its card is always visible); chapters wait the beat.
    if (reduced || section.kind === 'hero' || CARD_REVEAL_DELAY_MS === 0) {
      revealCard();
    } else {
      revealTimer = setTimeout(() => {
        revealTimer = null;
        revealCard();
      }, CARD_REVEAL_DELAY_MS);
    }
  }

  // Observe step cards; activate the one nearest the middle of the viewport.
  const steps = Array.from(document.querySelectorAll('.step'));
  const visibility = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visibility.set(e.target.dataset.id, e.intersectionRatio));
      let bestId = null;
      let best = 0;
      visibility.forEach((ratio, id) => {
        if (ratio > best) {
          best = ratio;
          bestId = id;
        }
      });
      if (bestId) activate(byId.get(bestId));
    },
    { root: null, threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-35% 0px -35% 0px' }
  );
  steps.forEach((s) => io.observe(s));

  // Graceful degradation: if the active overlay's source errors, note it in the legend.
  if (opts.onLayerError) {
    opts.onLayerError(({ sourceId }) => {
      const section = byId.get(activeId);
      if (section && section.layerConfig && section.layerConfig.sourceId === sourceId && legendEl) {
        if (!legendEl.querySelector('.legend-unavailable')) {
          const p = document.createElement('p');
          p.className = 'legend-unavailable';
          p.textContent = 'This layer could not load — showing basemap only.';
          legendEl.appendChild(p);
        }
      }
    });
  }

  // Activate the first section immediately (in case it's already in view on load).
  if (sections.length) activate(sections[0]);

  // Jump straight to a section without scroll animation (deep-linking / programmatic).
  function jumpTo(id) {
    const s = byId.get(id);
    if (!s) return;
    activeId = null; // force re-activation
    activate(s);
    isFlying = false;
    map.setView(s.camera.center, s.camera.zoom, { animate: false });
  }

  return { activate, jumpTo };
}

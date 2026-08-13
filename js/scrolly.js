// scrolly.js — scroll-driven storytelling. As each step card enters the viewport,
// fly the camera, toggle the right overlay, and swap the legend. Overlapping flyTo
// calls from fast scrolling are collapsed to the latest target via an isFlying guard.

import { setState } from './state.js';
import { MOTION, reduced } from './motion.js';

// Evidence, then interpretation: the map transforms first (camera + overlay), then
// after a brief beat the story card rises. From the shared motion vocabulary so the beat
// matches the other component timings. Set to 0 under reduced motion (card appears with all else).
const CARD_REVEAL_DELAY_MS = MOTION.delayNarrative;

// When a section arrives via a camera glide, its overlay shouldn't snap on at the start of the
// flight — it develops in on the tail, so the reader travels *to* the place and then sees the
// measurement. This is the fraction of the flight that elapses before the overlay is revealed.
// A tunable DESIGN constant, not a truth: the real target is "the overlay appears in the final
// third of the perceived journey" — retune against a real-motion recording. 0 when not flying
// (same-camera transitions like Vegetation<->Heat keep their concurrent in-place cross-dissolve)
// and under reduced motion.
const OVERLAY_LEAD_RATIO = 0.4;

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
  // Choreography timers, cleared together at the top of every activate() so fast forward- OR
  // reverse-scrolling never leaks a stale section's overlay-in or card into the next section.
  let overlayTimer = null; // pending incoming-overlay + legend + affordance reveal
  let cardTimer = null; // pending story-card reveal (a narrative beat after the evidence)

  function clearChoreography() {
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    if (cardTimer) {
      clearTimeout(cardTimer);
      cardTimer = null;
    }
  }

  function hideAllOverlays() {
    modules.forEach((m) => m.setVisible(map, false));
  }

  // Immediate half of a transition: hide the outgoing overlay (starts its fade) and bind the
  // LOGICAL overlay state to the destination right away, so the inspector samples the correct
  // layer from the first frame. The destination overlay is NOT shown here — that is deferred to
  // the glide's tail (see revealEvidence). Returns the incoming module (or null).
  function applyLayersImmediate(section) {
    hideAllOverlays();
    const overlays = { ndvi: false, thermal: false, maritime: false };
    const mod = (section.layerConfig && section.layerConfig.module) || null;
    if (mod && mod.key) overlays[mod.key] = true;
    setState({ overlays });
    return mod;
  }

  // "Are we moving, and for how long?" — decided once and shared by scheduleFly() and the
  // overlay/card lead timing, so the glide and the choreography agree. Mirrors scheduleFly()'s
  // instant-jump guards: identical start/target centre, a not-yet-laid-out map, or reduced motion.
  function flightPlan(section) {
    const cur = map.getCenter();
    const size = map.getSize();
    const [lat, lng] = section.camera.center;
    const sameCentre = Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6;
    const notReady =
      !size ||
      size.x === 0 ||
      size.y === 0 ||
      !Number.isFinite(cur.lat) ||
      !Number.isFinite(cur.lng);
    return {
      animate: !sameCentre && !notReady && !reduced(),
      duration: section.camera.duration || 2,
    };
  }

  let legendClearTimer = null;

  // --- Legend cross-fade morph (Vegetation <-> Heat: same place, different instrument) ---------
  // A frozen copy of the outgoing legend ("ghost") is overlaid on #legend and the two cross-fade,
  // so the viridis ramp dissolves into the inferno ramp in step with the map's raster cross-
  // dissolve — instead of the content blinking. morphLegend() owns ONLY the visual transition;
  // updateLegend() still owns the semantic legend content/state.
  let morphGhost = null;
  let morphTimer = null;
  // Idempotent: safe to call repeatedly (rapid Veg->Heat->Veg) and always fully resets, so a
  // cancelled transition can never leave the panel stuck at a stale inline height.
  function clearMorph() {
    if (morphTimer) {
      clearTimeout(morphTimer);
      morphTimer = null;
    }
    if (morphGhost) {
      morphGhost.remove();
      morphGhost = null;
    }
    legendEl.classList.remove('is-morphing', 'is-morph-in');
    if (legendWrap) {
      legendWrap.classList.remove('is-morphing');
      legendWrap.style.height = '';
    }
  }
  function morphLegend(newHTML) {
    clearMorph();
    // Snapshot the OLD geometry BEFORE any content is replaced (the ghost is the old legend's
    // exact box — NDVI and thermal legends can differ in height, so never re-measure after swap).
    const lr = legendEl.getBoundingClientRect();
    const pr = legendWrap.getBoundingClientRect();
    const oldPanelH = pr.height;
    const ghost = document.createElement('div');
    ghost.className = 'legend legend-ghost';
    ghost.setAttribute('aria-hidden', 'true'); // only ONE live legend is exposed to AT
    ghost.innerHTML = legendEl.innerHTML;
    ghost.style.left = `${lr.left - pr.left}px`;
    ghost.style.top = `${lr.top - pr.top}px`;
    ghost.style.width = `${lr.width}px`;
    ghost.style.height = `${lr.height}px`;
    legendWrap.appendChild(ghost);
    morphGhost = ghost;
    // Swap in the new content transparent, on the long (panel) transition.
    legendEl.innerHTML = newHTML;
    legendEl.classList.add('is-morphing', 'is-morph-in');
    // Keep the box stable: hold the old panel height, then ease it to the new content's height.
    // Height is the ONLY dimension that changes; width is fixed by the panel.
    legendWrap.classList.add('is-morphing');
    const newPanelH = legendWrap.getBoundingClientRect().height;
    const easeHeight = Math.abs(newPanelH - oldPanelH) > 0.5;
    if (easeHeight) legendWrap.style.height = `${oldPanelH}px`;
    void legendEl.offsetHeight; // commit the transparent start + held height before the fade
    requestAnimationFrame(() => {
      legendEl.classList.remove('is-morph-in'); // new -> opacity 1
      ghost.classList.add('is-out'); // old -> opacity 0
      if (easeHeight) legendWrap.style.height = `${newPanelH}px`;
    });
    morphTimer = setTimeout(() => {
      morphTimer = null;
      clearMorph();
    }, MOTION.durPanel + 80);
  }

  // Fade the legend panel out now and clear its content once faded. Used both when a section has
  // no legend and (M4) when the maritime layer travels in with the camera and the outgoing thermal
  // legend must not linger over the ships.
  function hideLegendNow() {
    if (!legendWrap) return;
    if (legendClearTimer) {
      clearTimeout(legendClearTimer);
      legendClearTimer = null;
    }
    clearMorph(); // cancel any in-flight morph
    legendWrap.classList.remove('is-shown'); // panel fades out via CSS
    // Clear the content only after the fade so it doesn't blank abruptly.
    const clear = () => {
      if (!legendWrap.classList.contains('is-shown')) legendEl.innerHTML = '';
      legendClearTimer = null;
    };
    // 350ms = local "clear after the panel has faded out" delay (must stay >= the panel fade so
    // content doesn't blank early); a one-off, not a shared motion token.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) clear();
    else legendClearTimer = setTimeout(clear, 350);
  }

  function updateLegend(section, opts = {}) {
    if (!legendEl) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (section.legendHTML && legendClearTimer) {
      clearTimeout(legendClearTimer);
      legendClearTimer = null;
    }
    if (section.legendHTML) {
      const swapping =
        legendWrap && legendWrap.classList.contains('is-shown') && legendEl.innerHTML;
      if (swapping && !reduced && opts.morph) {
        // Same place, different measurement: cross-fade the whole legend (ramp + labels) so it
        // transforms in step with the map, rather than blinking.
        morphLegend(section.legendHTML);
      } else if (swapping && !reduced) {
        // Different place (e.g. Heat -> Maritime): dip the content out, swap, fade back in.
        legendEl.classList.add('is-swapping');
        // 160ms = the one-off legend "swap dip" (matches the .legend transition in style.css).
        // A local implementation detail, intentionally not a shared motion token.
        legendClearTimer = setTimeout(() => {
          legendEl.innerHTML = section.legendHTML;
          legendEl.classList.remove('is-swapping');
          legendClearTimer = null;
        }, 160);
      } else {
        clearMorph(); // reduced motion / first show: land the content directly
        legendEl.innerHTML = section.legendHTML;
        legendEl.classList.remove('is-swapping');
      }
      if (legendWrap) legendWrap.classList.add('is-shown'); // panel fades in via CSS
    } else {
      hideLegendNow();
    }
  }

  function scheduleFly() {
    if (isFlying || !desired) return; // in-flight → handled on moveend
    const s = desired;
    flownId = s.id;
    isFlying = true;
    // flightPlan() encapsulates the instant-jump guards (identical centre → flyTo would divide by
    // zero; not-yet-laid-out map → NaN; reduced motion). Jump instantly unless a real glide is due.
    if (!flightPlan(s).animate) {
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

  // Notify the inspector when the destination raster is actually VISIBLE (not merely logically
  // active). A local scrolly<->inspect signal, deliberately kept out of the central store:
  // state.overlays answers "what data is logically active" (drives sampling); this answers "what
  // is currently visible" (drives the crosshair/hint affordance) — different concepts.
  const signalRasterVisible = opts.onRasterVisible || (() => {});

  const signalCompareEnter = opts.onCompareEnter || (() => {});
  const signalCompareExit = opts.onCompareExit || (() => {});

  function activate(section) {
    if (!section || section.id === activeId) return;
    const prev = byId.get(activeId); // the section we're leaving — captured BEFORE reassigning
    activeId = section.id;
    desired = section;
    map.closePopup(); // dismiss any inspect / vessel popup from the previous section
    setState({ section: section.id });

    // Activating anything that ISN'T compare tears down the swipe divider + un-freezes the map
    // BEFORE the new section reveals. Keyed off the destination (not `prev`) so it also fires when
    // leaving compare via jumpTo/deep-link, which resets activeId so `prev` would be undefined.
    // compare.exit() is idempotent (no-op unless compare is active), so calling it here is safe.
    if (section.kind !== 'compare') signalCompareExit();

    // Legend morph applies exactly when the map does an in-place overlay cross-dissolve: the two
    // sections share a camera centre and both carry a legend (Vegetation <-> Heat — same place,
    // different instrument). Derived from the camera, not hardcoded to section ids.
    const sameCam =
      prev &&
      prev.camera &&
      section.camera &&
      prev.camera.center[0] === section.camera.center[0] &&
      prev.camera.center[1] === section.camera.center[1];
    const morph = !!(prev && prev.legendHTML && section.legendHTML && sameCam);

    // Cancel any pending choreography from the previous section up front — this is what makes
    // fast forward- and reverse-scrolling safe (no stale overlay-in, affordance, or card).
    clearChoreography();

    // Decide the flight once; the overlay develops in on the glide's TAIL (0 when not flying, so
    // same-camera transitions like Vegetation<->Heat keep their concurrent in-place cross-dissolve).
    const plan = flightPlan(section);
    const overlayLeadDelay = plan.animate
      ? Math.round(OVERLAY_LEAD_RATIO * plan.duration * 1000)
      : 0;

    // Immediately: logical overlay state (so sampling binds to the destination) + outgoing fade +
    // hide the inspect affordance (the reader mustn't be told to click data that isn't visible yet).
    const incoming = applyLayersImmediate(section);
    signalRasterVisible(null);

    // A vector layer with no fade (maritime) travels WITH the camera: mount it BEFORE the flyTo so
    // the pane transform carries it in (its motion stays frozen until moveend via maritime.js's
    // mapMoving guard). Raster overlays fade, so they develop in on the glide's tail (below).
    const travelsWithCamera = !!(incoming && incoming.deferReveal === false);
    if (travelsWithCamera) incoming.setVisible(map, true);

    scheduleFly(); // camera begins now

    // Methods dims the map to a paper ground. This is the ONLY Methods-specific behaviour —
    // overlays/legend/inspector are already off via the engine's null-layer state above. The
    // class flips off on every other section, so the wash never lingers.
    document.body.classList.toggle('methods-active', section.kind === 'methods');
    // Compare = the two rasters split by a swipe divider over a frozen frame. Only chapter-specific
    // behaviour; overlays/legend are otherwise handled by the engine (layerConfig is null).
    document.body.classList.toggle('compare-active', section.kind === 'compare');

    // Legend timing. A section with no legend hides the panel now. A travels-with-camera layer
    // (maritime) also hides the OUTGOING legend now — the thermal legend must not linger over the
    // ships during the southward glide — and brings its own legend in on the tail. A raster section
    // defers its legend to the raster reveal, so the key never claims the new measurement early.
    const hasLegend = !!section.legendHTML;
    if (!hasLegend) updateLegend(section);
    else if (travelsWithCamera) hideLegendNow();

    // The evidence: the incoming overlay develops in (rasters only — maritime is already visible),
    // its legend transitions with it, and only now does the inspect affordance appear.
    const revealEvidence = () => {
      overlayTimer = null;
      if (incoming && !travelsWithCamera) incoming.setVisible(map, true);
      // Compare reveals BOTH overlays + the divider here (its own controller), in the same slot a
      // single raster would develop in — after applyLayersImmediate's hideAllOverlays, so nothing
      // races it hidden.
      if (section.kind === 'compare') signalCompareEnter();
      if (hasLegend) updateLegend(section, { morph });
      signalRasterVisible(incoming && incoming.key ? incoming.key : null);
    };
    if (overlayLeadDelay === 0) revealEvidence();
    else overlayTimer = setTimeout(revealEvidence, overlayLeadDelay);

    // The interpretation: the story card rises last, a narrative beat after the evidence lands.
    document.querySelectorAll('.step').forEach((el) => el.classList.remove('is-active'));
    const revealCard = () => {
      cardTimer = null;
      document.querySelectorAll('.step').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.id === section.id);
      });
    };
    // Hero reveals immediately (its card is always visible); chapters wait until the evidence has
    // appeared (overlayLeadDelay) plus the narrative beat.
    const cardDelay =
      reduced() || section.kind === 'hero' ? 0 : overlayLeadDelay + CARD_REVEAL_DELAY_MS;
    if (cardDelay === 0) revealCard();
    else cardTimer = setTimeout(revealCard, cardDelay);
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

  // Jump straight to a section without scroll animation (deep-linking / programmatic). Move the
  // camera FIRST, then activate: flightPlan() then sees the destination as already reached
  // (sameCentre), so the overlay/legend/affordance/card all reveal instantly — no lead delay.
  function jumpTo(id) {
    const s = byId.get(id);
    if (!s) return;
    activeId = null; // force re-activation
    isFlying = false;
    map.setView(s.camera.center, s.camera.zoom, { animate: false });
    activate(s);
    // Bring the section's card into view so a #deep-link lands on the right chapter — not the hero
    // card at scroll-top. Instant (a navigation, not an animation); the observer re-firing activate()
    // for the same id is a no-op.
    const stepEl = document.querySelector(`.step[data-id="${id}"]`);
    if (stepEl) stepEl.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  return { activate, jumpTo };
}

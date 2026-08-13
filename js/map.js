// map.js — Leaflet map init, real satellite basemaps + toggle, overlay registration.
//
// Leaflet (not WebGL) is used deliberately: it renders raster tiles as plain <img>,
// so it needs no web worker, no WebGL context and no tile CORS — it is robust in every
// browser and embedded preview. For satellite imagery a flat, top-down view also reads
// more truthfully than a tilted 3D one.
//
// Two grounds, both free and keyless:
//   - EOX Sentinel-2 cloudless    : a real global cloudless Sentinel-2 mosaic (default).
//   - Esri "World Light Gray Canvas" : a neutral reference basemap so the data can dominate.
// The reader chooses between them; the story does not swap the ground on scroll.
// See docs/swap-instructions.md.

import { setState, subscribe } from './state.js';
import { MOTION, cssTransition } from './motion.js';

// OneMap (Singapore Land Authority) is prepared but NOT shipped live. Its tiles are token-free
// per the OneMap docs, but its Terms of Use MANDATE embedding the official OneMap logo +
// attribution, which is a government asset that must not be fabricated. So the entries below
// stay disabled (filtered out of the UI) until the ToU is confirmed for this public site and
// the official logo is embedded in their `attribution`. Flip this one flag to enable both.
const ONEMAP_ENABLED = false;

export const BASEMAPS = {
  // Default true-colour ground.
  sentinel2: {
    key: 'sentinel2',
    label: 'Sentinel-2 cloudless',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    attribution:
      'Sentinel-2 cloudless © <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data)',
    maxNativeZoom: 15,
    crossOrigin: true,
    enabled: true,
  },
  // Neutral grey reference basemap — an alternative ground that lets the data dominate.
  esriLightGray: {
    key: 'esriLightGray',
    label: 'Grey canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community',
    maxNativeZoom: 16,
    crossOrigin: true,
    enabled: true,
  },
  // --- OneMap, prepared but DISABLED (see ONEMAP_ENABLED). Before enabling: embed the
  // official OneMap logo in `attribution` and confirm the ToU/limits for this site. No
  // crossOrigin — these tiles are only rendered, never pixel-sampled, so requiring CORS
  // headers would be a needless failure mode. `fallback` covers unavailability/rate-limits. ---
  onemapGrey: {
    key: 'onemapGrey',
    label: 'OneMap Grey',
    url: 'https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.onemap.gov.sg" target="_blank" rel="noopener">OneMap</a> · Singapore Land Authority',
    maxNativeZoom: 18,
    fallback: 'esriLightGray',
    enabled: ONEMAP_ENABLED,
  },
  onemapNight: {
    key: 'onemapNight',
    label: 'OneMap Night',
    url: 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.onemap.gov.sg" target="_blank" rel="noopener">OneMap</a> · Singapore Land Authority',
    maxNativeZoom: 18,
    fallback: 'esriLightGray',
    enabled: ONEMAP_ENABLED,
  },
};

// Sentinel-2 true colour is the default ground; the reader can switch to the grey canvas.
// The story does not change the ground on scroll — the choice is the reader's.
const DEFAULT_BASEMAP = 'sentinel2';

// Leaflet uses [lat, lng]. Hero / default framing of the whole island.
export const HOME_VIEW = { center: [1.352, 103.82], zoom: 11 };
// Intro framing is deliberately offset from the hero so the opening flyTo has travel
// (an identical start/target centre makes Leaflet's flyTo interpolation divide by zero).
export const INTRO_VIEW = { center: [1.15, 104.3], zoom: 9 };

// Simple pub/sub so the UI (legend) can react to tile/overlay failures.
const errorListeners = new Set();
export function onLayerError(fn) {
  errorListeners.add(fn);
}
function notifyError(info) {
  errorListeners.forEach((fn) => fn(info));
}

const basemapLayers = {}; // key -> L.TileLayer
let activeKey = DEFAULT_BASEMAP;

export function createMap(container = 'map') {
  const map = L.map(container, {
    center: INTRO_VIEW.center,
    zoom: INTRO_VIEW.zoom,
    minZoom: 6,
    maxZoom: 17,
    zoomControl: false,
    attributionControl: true,
    keyboard: true, // accessibility
    worldCopyJump: false,
    // This is a scroll-driven story: a plain wheel/two-finger scroll must move the page,
    // not zoom the map. Wheel-zoom is handled manually below, gated on Ctrl/⌘ (and
    // trackpad pinch, which browsers deliver as a ctrl+wheel event).
    scrollWheelZoom: false,
    // Snap the RESTING zoom to whole levels. flyTo still animates smoothly through fractional
    // zooms; only the settled zoom snaps to an integer. This is what keeps tiles at their native
    // pixel size at rest — a fractional resting zoom scales tiles to non-integer sizes, opening
    // subpixel seams that reveal the themed page background as faint gridlines (M7). Trade-off: the
    // manual Ctrl/⌘+wheel zoom now lands on integers instead of any fractional value.
    zoomSnap: 1,
  });
  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'
  );
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Intentional wheel-zoom: only when Ctrl/⌘ is held or a trackpad pinch is used.
  // Otherwise the event is left alone so the story scrolls normally.
  map.getContainer().addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain scroll → page scrolls
      e.preventDefault();
      const factor = Math.max(-1, Math.min(1, -e.deltaY * 0.01));
      map.setZoomAround(map.mouseEventToLatLng(e), map.getZoom() + factor);
    },
    { passive: false }
  );

  // Mount only the opening ground; other basemaps are added lazily on first use so the
  // mounted set stays bounded (see setBasemap). Each basemap renders into its own pane so
  // grounds can cross-fade via pane opacity.
  mountBasemap(map, DEFAULT_BASEMAP, 1);

  return map;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const paneName = (key) => `basemap-${key}`;

// Each basemap lives in its own pane, below the overlay pane, with an opacity transition so
// two grounds can cross-fade. Panes are created once and reused (Leaflet has no removePane).
function ensurePane(map, key) {
  const name = paneName(key);
  let pane = map.getPane(name);
  if (!pane) {
    pane = map.createPane(name);
    pane.style.zIndex = '200'; // above the (unused) default tilePane, below overlayPane (400)
    // Ground cross-fade uses the shared "panel" duration + ground easing (see js/motion.js).
    pane.style.transition = reducedMotion()
      ? 'none'
      : cssTransition('opacity', MOTION.durPanel, MOTION.easeGround);
  }
  return pane;
}

function setPaneOpacity(map, key, opacity) {
  const pane = map.getPane(paneName(key));
  if (pane) pane.style.opacity = String(opacity);
}

// Tile-error bookkeeping for the OneMap fallback: notify once per ground, and fall back at
// most once per ground (tileerror fires repeatedly and asynchronously).
const tileErrorCounts = {};
const fellBack = new Set();

// Add a basemap's tile layer into its pane (creating both lazily) at the given opacity.
function mountBasemap(map, key, opacity) {
  const b = BASEMAPS[key];
  if (!b) return null;
  ensurePane(map, key);
  let layer = basemapLayers[key];
  if (!layer) {
    layer = L.tileLayer(b.url, {
      pane: paneName(key),
      attribution: b.attribution,
      maxNativeZoom: b.maxNativeZoom,
      maxZoom: 17,
      // Only where the config asks for it — never pixel-sample the basemap tiles, so requiring
      // CORS headers (crossOrigin) would just add a failure mode (e.g. for OneMap).
      crossOrigin: b.crossOrigin || undefined,
    });
    layer.on('tileerror', () => {
      const n = (tileErrorCounts[key] = (tileErrorCounts[key] || 0) + 1);
      if (n === 1) notifyError({ sourceId: `basemap-${key}`, message: 'tile load error' });
      // Unavailability / rate-limit fallback: only while this ground is still active, only if
      // it declares a fallback, and only ONCE — so repeated async tileerrors can't churn state.
      if (b.fallback && key === activeKey && !fellBack.has(key) && n >= 4) {
        fellBack.add(key);
        setBasemap(map, b.fallback);
      }
    });
    basemapLayers[key] = layer;
  }
  if (!map.hasLayer(layer)) layer.addTo(map);
  setPaneOpacity(map, key, opacity);
  return layer;
}

// Pending removal of the outgoing ground after a fade — tracked so a fast re-selection can
// cancel it (and so we never remove a layer we're about to reuse).
let pendingCleanup = null;

// Cross-fade the active ground to `key`. The story owns the ground during scrolling; a
// manual toggle is a temporary override that the next section reasserts. All basemap changes
// flow through here and publish `state.basemap`, so the toggle buttons can reflect the
// active ground whether the change came from a click or from the story. Returns the active
// key. Only the active ground (plus, briefly, the one fading out) stays mounted.
export function setBasemap(map, key) {
  if (!BASEMAPS[key]) return activeKey;

  // Cancel any in-flight cleanup so we don't remove a ground we're about to reuse.
  if (pendingCleanup) {
    clearTimeout(pendingCleanup.timer);
    pendingCleanup = null;
  }

  if (key === activeKey) {
    // Already active — make sure it's mounted and fully opaque (a prior fade may have left
    // its pane at 0, or cleanup may have removed the layer).
    mountBasemap(map, key, 1);
    setState({ basemap: key });
    return activeKey;
  }

  const outgoing = activeKey;
  const instant = reducedMotion();
  // Mount incoming beneath (transparent, unless reduced motion), then fade it up.
  mountBasemap(map, key, instant ? 1 : 0);
  activeKey = key;
  setState({ basemap: key });

  const finishCleanup = () => {
    const prev = basemapLayers[outgoing];
    if (prev && outgoing !== activeKey && map.hasLayer(prev)) map.removeLayer(prev);
    pendingCleanup = null;
  };

  if (instant) {
    setPaneOpacity(map, outgoing, 0);
    finishCleanup();
  } else {
    // Next frame, so the 0→1 opacity change actually transitions rather than snapping.
    requestAnimationFrame(() => {
      setPaneOpacity(map, key, 1);
      setPaneOpacity(map, outgoing, 0);
    });
    // Remove the outgoing ground once its fade-out has finished (fade duration + a small buffer).
    pendingCleanup = { key: outgoing, timer: setTimeout(finishCleanup, MOTION.durPanel + 60) };
  }
  return activeKey;
}

export function getActiveBasemap() {
  return activeKey;
}

// Wire a basemap toggle in the given container element. Implemented as toggle buttons
// (aria-pressed) rather than an ARIA radiogroup — simpler and truer to how the control
// behaves, and it needs no custom arrow-key handling. The buttons reflect state.basemap and
// re-sync whenever it changes, so the highlight tracks the active ground whether the change
// came from a click or from the story reasserting its per-section ground.
export function registerBasemapToggle(map, container) {
  const buttons = new Map();
  const sync = (key) => {
    buttons.forEach((el, k) => {
      el.setAttribute('aria-pressed', String(k === key));
      el.classList.toggle('is-active', k === key);
    });
  };
  // Only enabled grounds appear in the UI. Disabled entries (e.g. OneMap while ONEMAP_ENABLED
  // is false) are filtered out BEFORE the DOM is created — genuinely unreachable, not CSS-hidden.
  Object.values(BASEMAPS)
    .filter((b) => b.enabled)
    .forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'basemap-btn';
      btn.type = 'button';
      btn.textContent = b.label;
      btn.setAttribute('aria-label', `Basemap: ${b.label}`);
      // A click sets the ground; setBasemap publishes state.basemap, which drives the sync.
      btn.addEventListener('click', () => setBasemap(map, b.key));
      buttons.set(b.key, btn);
      container.appendChild(btn);
    });
  sync(activeKey);
  subscribe((s) => sync(s.basemap));
}

// Register every overlay layer module (adds hidden layers once the map exists).
export function registerOverlays(map, modules) {
  modules.forEach((mod) => {
    if (mod && typeof mod.add === 'function') mod.add(map, { notifyError });
  });
}

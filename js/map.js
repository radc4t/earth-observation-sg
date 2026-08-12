// map.js — Leaflet map init, real satellite basemaps + toggle, overlay registration.
//
// Leaflet (not WebGL) is used deliberately: it renders raster tiles as plain <img>,
// so it needs no web worker, no WebGL context and no tile CORS — it is robust in every
// browser and embedded preview. For satellite imagery a flat, top-down view also reads
// more truthfully than a tilted 3D one.
//
// Basemaps are REAL, free, no-API-key satellite imagery:
//   - EOX Sentinel-2 cloudless : a real global cloudless Sentinel-2 mosaic (default).
//   - Esri World Imagery       : very high-resolution aerial/satellite, for detail.
// The data overlays (NDVI / thermal / maritime) are illustrative placeholders and live
// in js/layers/*. See docs/swap-instructions.md.

export const BASEMAPS = {
  sentinel2: {
    key: 'sentinel2',
    label: 'Sentinel-2 cloudless',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    attribution:
      'Sentinel-2 cloudless © <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data)',
    maxNativeZoom: 15,
  },
  esri: {
    key: 'esri',
    label: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Imagery © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
};

const DEFAULT_BASEMAP = 'sentinel2';

// Leaflet uses [lat, lng]. Hero / default framing of the whole island.
export const HOME_VIEW = { center: [1.352, 103.82], zoom: 11 };
// Intro framing is deliberately offset from the hero so the opening flyTo has travel
// (an identical start/target centre makes Leaflet's flyTo interpolation divide by zero).
export const INTRO_VIEW = { center: [1.15, 104.3], zoom: 9 };

// Simple pub/sub so the UI (legend) can react to tile/overlay failures.
const errorListeners = new Set();
export function onLayerError(fn) { errorListeners.add(fn); }
function notifyError(info) { errorListeners.forEach((fn) => fn(info)); }

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
    zoomSnap: 0, // allow smooth fractional zoom from the manual wheel handler
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

  Object.values(BASEMAPS).forEach((b) => {
    const layer = L.tileLayer(b.url, {
      attribution: b.attribution,
      maxNativeZoom: b.maxNativeZoom,
      maxZoom: 17,
      crossOrigin: true,
    });
    layer.on('tileerror', () => notifyError({ sourceId: `basemap-${b.key}`, message: 'tile load error' }));
    basemapLayers[b.key] = layer;
  });
  basemapLayers[DEFAULT_BASEMAP].addTo(map);

  return map;
}

// Show one basemap, hide the others. Returns the active key.
export function setBasemap(map, key) {
  if (!basemapLayers[key] || key === activeKey) return activeKey;
  if (basemapLayers[activeKey]) map.removeLayer(basemapLayers[activeKey]);
  // keep the basemap beneath overlays
  basemapLayers[key].addTo(map);
  if (basemapLayers[key].bringToBack) basemapLayers[key].bringToBack();
  activeKey = key;
  return key;
}

export function getActiveBasemap() { return activeKey; }

// Wire a two-button basemap toggle in the given container element. Implemented as a pair
// of toggle buttons (aria-pressed) rather than an ARIA radiogroup — simpler and truer to
// how the control behaves, and it needs no custom arrow-key handling.
export function registerBasemapToggle(map, container) {
  const buttons = new Map();
  Object.values(BASEMAPS).forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'basemap-btn';
    btn.type = 'button';
    btn.textContent = b.label;
    btn.setAttribute('aria-label', `Basemap: ${b.label}`);
    btn.setAttribute('aria-pressed', String(activeKey === b.key));
    if (activeKey === b.key) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      setBasemap(map, b.key);
      buttons.forEach((el, k) => {
        el.setAttribute('aria-pressed', String(k === b.key));
        el.classList.toggle('is-active', k === b.key);
      });
    });
    buttons.set(b.key, btn);
    container.appendChild(btn);
  });
}

// Register every overlay layer module (adds hidden layers once the map exists).
export function registerOverlays(map, modules) {
  modules.forEach((mod) => {
    if (mod && typeof mod.add === 'function') mod.add(map, { notifyError });
  });
}

// config.js — the story. Each section drives the camera, the active overlay,
// the legend and the copy for one scroll step.

import { ndviLayer } from './layers/ndvi.js';
import { thermalLayer } from './layers/thermal.js';
import { maritimeLayer, VESSEL_TYPES } from './layers/maritime.js';
import { LAYER_META } from './metadata.js';
import { RAMPS } from './ramps.js';

const M = LAYER_META;
// Colour ramps come from the single source of truth (js/ramps.js) — the same stops the
// Python builders use to colourise the PNGs, so legends and overlays cannot drift.
const VIRIDIS_STOPS = RAMPS.viridis;
const INFERNO_STOPS = RAMPS.inferno;

// Legend header: just the layer title. The at-a-glance REAL / ILLUSTRATION classification lives in
// the Methods chapter now — in the always-on legend it read as defensive clutter, and the
// provenance note below already answers "real or illustrative, and from where?" calmly.
function legendHead(title) {
  return `<div class="legend-head"><h3>${title}</h3></div>`;
}

// Provenance note for a REAL layer, and the context note for an illustrative one — all
// derived from js/metadata.js so wording can't drift from the About panel.
function realNote(m, extra) {
  return (
    `<p class="legend-note">Real: ${m.source} · ${m.date} · ${m.sourceResolution} source, ` +
    `${m.displayResolution} display grid${extra ? ' · ' + extra : ''}</p>`
  );
}
function illustrationNote(m) {
  return `<p class="legend-note">${m.illustrationNote}</p>`;
}

function rampSvg(stops, leftLabel, rightLabel, id, ticks) {
  const gid = `grad-${id}`;
  const offsets = stops
    .map(([pos, hex]) => `<stop offset="${pos * 100}%" stop-color="${hex}"/>`)
    .join('');
  // Optional numeric ticks sit directly under the ramp — same format as the °C legend — with the
  // plain-language ends kept below as a caption, so the ramp reads scale-then-meaning.
  const ticksRow = ticks
    ? `<div class="legend-ticks">${ticks.map((t) => `<span>${t}</span>`).join('')}</div>`
    : '';
  return `
    <div class="legend-ramp">
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" width="100%" height="12" role="img"
           aria-label="colour scale from ${leftLabel} to ${rightLabel}">
        <defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0">${offsets}</linearGradient></defs>
        <rect x="0" y="0" width="200" height="12" rx="2" fill="url(#${gid})"/>
      </svg>
      ${ticksRow}
      <div class="legend-ends"><span>${leftLabel}</span><span>${rightLabel}</span></div>
    </div>`;
}

// A colour ramp annotated with real numeric ticks (e.g. °C) beneath it.
function valueRamp(stops, ticks, unit, id) {
  const gid = `grad-${id}`;
  const offsets = stops
    .map(([pos, hex]) => `<stop offset="${pos * 100}%" stop-color="${hex}"/>`)
    .join('');
  return `
    <div class="legend-ramp">
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" width="100%" height="12" role="img"
           aria-label="colour scale from ${ticks[0]}${unit} to ${ticks[ticks.length - 1]}${unit}">
        <defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0">${offsets}</linearGradient></defs>
        <rect x="0" y="0" width="200" height="12" rx="2" fill="url(#${gid})"/>
      </svg>
      <div class="legend-ticks">${ticks.map((t) => `<span>${t}${unit}</span>`).join('')}</div>
    </div>`;
}

function tempTicks(min, max, n = 4) {
  return Array.from({ length: n }, (_, i) => Math.round(min + ((max - min) * i) / (n - 1)));
}

// NDVI numeric ticks — evenly spaced over the display range so equal visual spacing (the
// .legend-ticks flex layout) matches the linear ramp. Endpoints come from metadata
// (displayMin/displayMax), so they stay in step with the inspector's value mapping. 2 decimals.
function ndviTicks(min, max, n = 5) {
  return Array.from({ length: n }, (_, i) => (min + ((max - min) * i) / (n - 1)).toFixed(2));
}

function vesselSwatches() {
  return (
    '<div class="legend-swatches">' +
    Object.entries(VESSEL_TYPES)
      .map(([name, col]) => `<span class="sw"><i style="background:${col}"></i>${name}</span>`)
      .join('') +
    '</div>'
  );
}

export const SECTIONS = [
  {
    id: 'hero',
    // Short label for the chapter-nav rail (js/nav.js). Kept here so the story config stays the
    // single source for per-section copy — the rail can't drift from the sections it represents.
    nav: 'Intro',
    kind: 'hero',
    camera: { center: [1.352, 103.82], zoom: 11, duration: 1.8 },
    layerConfig: null,
    legendHTML: '',
    copy: {
      title: 'Singapore, from space',
      body:
        'Every day, Earth-observation satellites photograph our island in wavelengths the eye can’t see. ' +
        'This is what that data reveals — about our greenery, our heat, and the ships at our doorstep. Scroll to explore.',
    },
  },
  {
    id: 'vegetation',
    nav: 'Vegetation',
    kind: 'section',
    // Vegetation and heat share one camera (whole-island framing) so scrolling between
    // them cross-fades the NDVI and temperature layers in place — no zoom/pan jump.
    camera: { center: [1.35, 103.8], zoom: 12, duration: 1.4 },
    layerConfig: {
      id: ndviLayer.id,
      sourceId: ndviLayer.sourceId,
      module: ndviLayer,
      visible: true,
    },
    legendHTML:
      legendHead(M.ndvi.title) +
      rampSvg(
        VIRIDIS_STOPS,
        M.ndvi.rampEnds[0],
        M.ndvi.rampEnds[1],
        'ndvi',
        ndviTicks(M.ndvi.displayMin, M.ndvi.displayMax)
      ) +
      realNote(M.ndvi, 'clouds &amp; water masked'),
    copy: {
      title: 'How green is Singapore, really?',
      body:
        'Satellites measure how strongly the land reflects near-infrared light — healthy plants glow in it. ' +
        'Combined into a Vegetation Index (NDVI), it maps living green cover, from the dense canopy over the ' +
        'Central Catchment and Bukit Timah to the bare ground of a new worksite.',
      users: 'NParks, environmental agencies, researchers',
      why:
        'Tracking green-cover change over time shows where the city is greening — and where tree cover is ' +
        'being lost — guiding reforestation and the “City in Nature” goal.',
    },
  },
  {
    id: 'heat',
    nav: 'Heat',
    kind: 'section',
    // Same camera as vegetation (see note there) — the layers swap without moving the map, so
    // this duration is INERT (no fly happens on Veg→Heat); it only matters if arriving from
    // elsewhere. Kept in step with vegetation.
    camera: { center: [1.35, 103.8], zoom: 12, duration: 1.4 },
    layerConfig: {
      id: thermalLayer.id,
      sourceId: thermalLayer.sourceId,
      module: thermalLayer,
      visible: true,
    },
    legendHTML:
      legendHead(M.thermal.title) +
      valueRamp(INFERNO_STOPS, tempTicks(M.thermal.tminC, M.thermal.tmaxC), '°C', 'thermal') +
      realNote(M.thermal, 'clouds, shadow &amp; water masked'),
    copy: {
      title: 'The city makes its own heat',
      body:
        'Thermal sensors read the temperature of the ground itself. Industrial Jurong and Tuas, and dense ' +
        'built-up estates, store and re-radiate heat — an “urban heat island.” Reservoirs, the Botanic ' +
        'Gardens and the forested centre stay markedly cooler.',
      users: 'URA, HDB, climate-resilience planners',
      why:
        'Seeing where heat concentrates tells planners where cooling matters most — shade, greenery, ' +
        'water and building design — as Singapore adapts to a warming climate.',
    },
  },
  {
    id: 'maritime',
    nav: 'Maritime',
    kind: 'section',
    // Same longitude as heat, so the move to the Strait is a smooth vertical glide south. The
    // maritime layer travels in with this camera (mounted before the fly), so the duration sets
    // how the trip to the Strait feels — tuned to read as travelling to a new observation site.
    camera: { center: [1.205, 103.8], zoom: 11, duration: 1.8 },
    layerConfig: {
      id: maritimeLayer.id,
      sourceId: maritimeLayer.sourceId,
      module: maritimeLayer,
      visible: true,
    },
    legendHTML: legendHead(M.maritime.title) + vesselSwatches() + illustrationNote(M.maritime),
    copy: {
      title: 'One of the world’s busiest waterways',
      body:
        'Ships broadcast their position over AIS, and satellites listen from orbit. Plotted together, the ' +
        'vessels trace the shipping lanes of the Singapore Strait — tankers, container ships and bulk ' +
        'carriers threading past the island in a near-constant stream.',
      users: 'MPA, maritime security, port operations',
      why:
        'Space-based vessel tracking supports safe navigation, pollution response and maritime security in ' +
        'one of the most heavily trafficked straits on Earth — and underpins Singapore’s role as a global port.',
    },
  },
  {
    // Methods = a quiet "field notes" beat after maritime: the map dims to a paper ground
    // (scrolly's kind:'methods' branch) and the card explains what each layer is + how it was
    // made. layerConfig:null means the existing engine hides overlays/legend/inspector — no
    // Methods-specific layer lifecycle. A camera is still required (scheduleFly reads it); the
    // fly happens under the wash, so this whole-island framing is just a safe default.
    id: 'methods',
    nav: 'Methods',
    kind: 'methods',
    camera: { center: [1.352, 103.82], zoom: 10, duration: 1.2 },
    layerConfig: null,
    legendHTML: '',
    copy: {
      title: 'How these pictures were made',
    },
  },
  {
    id: 'outro',
    nav: 'Summary',
    kind: 'outro',
    camera: { center: [1.352, 103.82], zoom: 10, duration: 1.6 },
    layerConfig: null,
    legendHTML: '',
    copy: {
      title: 'Land, heat, and sea — one island, observed',
      body:
        'Green cover, surface heat and maritime traffic are three views of the same place, each read from space. ' +
        'This is the promise of Singapore’s Earth Observation Initiative: turning satellite data into ' +
        'understanding people can act on — for the environment, the city and the sea. Public agencies observe ' +
        'the Earth so the public can see it too.',
    },
  },
];

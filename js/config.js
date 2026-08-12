// config.js — the story. Each section drives the camera, the active overlay,
// the legend and the copy for one scroll step.
//
// COLOUR-RAMP SINGLE SOURCE OF TRUTH (paired edit): the VIRIDIS/INFERNO hex stops
// below are duplicated from scripts/generate-placeholders/generate_overlays.py. If you
// change a ramp in the Python generator, change it here too, or the overlay PNG and
// its legend gradient will drift.

import { ndviLayer } from './layers/ndvi.js';
import { thermalLayer } from './layers/thermal.js';
import { maritimeLayer, VESSEL_TYPES } from './layers/maritime.js';

const VIRIDIS_STOPS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
const INFERNO_STOPS = ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'];

function rampSvg(stops, leftLabel, rightLabel, id) {
  const gid = `grad-${id}`;
  const offsets = stops
    .map((c, i) => `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${c}"/>`)
    .join('');
  return `
    <div class="legend-ramp">
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" width="100%" height="12" role="img"
           aria-label="colour scale from ${leftLabel} to ${rightLabel}">
        <defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0">${offsets}</linearGradient></defs>
        <rect x="0" y="0" width="200" height="12" rx="2" fill="url(#${gid})"/>
      </svg>
      <div class="legend-ends"><span>${leftLabel}</span><span>${rightLabel}</span></div>
    </div>`;
}

function vesselSwatches() {
  return (
    '<div class="legend-swatches">' +
    Object.entries(VESSEL_TYPES)
      .map(
        ([name, col]) =>
          `<span class="sw"><i style="background:${col}"></i>${name}</span>`
      )
      .join('') +
    '</div>'
  );
}

export const SECTIONS = [
  {
    id: 'hero',
    kind: 'hero',
    camera: { center: [1.352, 103.82], zoom: 11, duration: 2.4 },
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
    kind: 'section',
    camera: { center: [1.353, 103.79], zoom: 12.5, duration: 2 },
    layerConfig: { id: ndviLayer.id, sourceId: ndviLayer.sourceId, module: ndviLayer, visible: true },
    legendHTML:
      '<h3>Vegetation index (NDVI)</h3>' +
      rampSvg(VIRIDIS_STOPS, 'Bare / built', 'Dense canopy', 'ndvi') +
      '<p class="legend-note">Real: Sentinel-2 NDVI · 28 Jul 2024 · clouds &amp; water masked</p>',
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
    kind: 'section',
    camera: { center: [1.330, 103.76], zoom: 11.5, duration: 2 },
    layerConfig: { id: thermalLayer.id, sourceId: thermalLayer.sourceId, module: thermalLayer, visible: true },
    legendHTML:
      '<h3>Land surface temperature</h3>' +
      rampSvg(INFERNO_STOPS, 'Cooler', 'Hotter', 'thermal') +
      '<p class="legend-note">Illustrative placeholder · real source: Landsat 8/9 thermal band</p>',
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
    kind: 'section',
    camera: { center: [1.205, 103.80], zoom: 11.5, duration: 2 },
    layerConfig: { id: maritimeLayer.id, sourceId: maritimeLayer.sourceId, module: maritimeLayer, visible: true },
    legendHTML:
      '<h3>Vessel traffic</h3>' +
      vesselSwatches() +
      '<p class="legend-note">Simulated tracks · real source: AIS transponder data</p>',
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
    id: 'outro',
    kind: 'outro',
    camera: { center: [1.352, 103.82], zoom: 10.5, duration: 2.2 },
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

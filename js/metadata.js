// metadata.js — single source of truth for each data layer's provenance.
//
// The legends (js/config.js) and the "About the data" panel (index.html) both read from
// this object, so wording about source, date, resolution and real-vs-illustrative status
// never drifts between them.
//
// `displayResolution` for NDVI is tied to OUT_W in
// scripts/generate-placeholders/build_real_ndvi.py — if you change OUT_W, update it here
// (the script prints the exact value). It is deliberately distinct from the 10 m *source*
// resolution: the exported PNG is 10 m Sentinel-2 resampled to the display grid, so it
// must not be described as "10 m".

export const LAYER_META = {
  ndvi: {
    real: true,
    title: 'Vegetation index (NDVI)',
    source: 'Sentinel-2 L2A · Copernicus',
    date: '28 Jul 2024',
    sourceResolution: '10 m',
    displayResolution: '~16 m/px',
    processing: ['NDVI = (B08 − B04)/(B08 + B04)', 'cloud & water masked (SCL)'],
    rampEnds: ['Bare / built', 'Dense canopy'],
  },
  thermal: {
    real: false,
    title: 'Land surface temperature',
    // Named so the placeholder can never be mistaken for an observation.
    badge: 'Illustration',
    illustrationNote: 'Illustration — not observational data',
    realSource: 'Landsat 8/9 thermal band (Collection 2 surface temperature)',
    rampEnds: ['Cooler', 'Hotter'],
  },
  maritime: {
    real: false,
    title: 'Vessel traffic',
    badge: 'Simulation',
    illustrationNote: 'Simulated tracks — not live AIS',
    realSource: 'AIS transponder data',
  },
};

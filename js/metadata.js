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
    // Short editorial "how it was made" line for the Methods chapter (the exact band formula
    // lives in `processing` above + docs/swap-instructions.md).
    methodNote: 'NDVI from red + near-infrared reflectance; cloud & water masked.',
    rampEnds: ['Bare / built', 'Dense canopy'],
    // NDVI value range mapped onto the ramp — must match NDVI_LO / NDVI_HI in
    // build_real_ndvi.py so click-to-inspect reports the right value.
    displayMin: 0.05,
    displayMax: 0.85,
  },
  thermal: {
    real: true,
    title: 'Land surface temperature',
    source: 'Landsat 9 · Collection 2',
    date: '6 Jul 2025',
    sourceResolution: '30 m (100 m thermal)',
    displayResolution: '~32 m/px',
    units: '°C',
    // Display range from build_real_thermal.py (2nd–98th percentile of clear land pixels).
    // Update alongside a rebuild; the script prints the values.
    tminC: 33,
    tmaxC: 48,
    processing: ['ST_B10 → °C', 'cloud, shadow & water masked (QA_PIXEL + QA_RADSAT)'],
    methodNote: 'Thermal band converted to °C; cloud, shadow & water masked.',
    rampEnds: ['Cooler', 'Hotter'],
  },
  maritime: {
    real: false,
    title: 'Vessel traffic',
    // Classification label (shown in the legend badge + About panel): the two-category
    // vocabulary is REAL / ILLUSTRATION. The "simulated" specifics live in illustrationNote.
    badge: 'Illustration',
    illustrationNote: 'Simulated tracks — not live AIS',
    realSource: 'AIS transponder data',
  },
};

// Build the Methods-chapter per-layer rows straight from LAYER_META, so the visible provenance
// (source, date, resolution, real-vs-illustrative) has a SINGLE source of truth shared with the
// legends and cards — it can never drift. Data-driven, but written for a reader: one classified
// row per layer + a single honest caveat, not a metadata dump. The deeper technical detail
// (band formulas, credits, basemap sources, swap docs) lives in the "Full provenance" details
// in index.html. Order follows the story.
export function methodsHTML() {
  const order = ['ndvi', 'thermal', 'maritime'];
  const rows = order
    .map((k) => {
      const m = LAYER_META[k];
      // The spec line describes each layer plainly — a real layer names its source/date/resolution;
      // the illustrative one says "Simulated tracks" up front. No "real vs illustration" labelling.
      const spec = m.real
        ? `${m.source} · ${m.date} · ${m.sourceResolution} source`
        : `Simulated tracks · from ${m.realSource}`;
      const note = m.real ? m.methodNote : m.illustrationNote;
      return (
        `<div class="method-row">` +
        `<div class="method-head"><span class="method-name">${m.title}</span></div>` +
        `<p class="method-spec">${spec}</p>` +
        `<p class="method-note">${note}</p>` +
        `</div>`
      );
    })
    .join('');
  return (
    rows +
    '<p class="method-caveat">Each layer is a single-date snapshot — not a time series — and the ' +
    'three are separate acquisitions, not a same-day comparison.</p>'
  );
}

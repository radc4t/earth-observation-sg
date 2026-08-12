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

// Build the "About the data" panel body straight from LAYER_META, so the per-layer facts
// (source, date, resolution) have a SINGLE source of truth shared with the legends — the
// About panel can never drift from them. Order follows the story.
export function aboutDataHTML() {
  const order = ['ndvi', 'thermal', 'maritime'];
  return order
    .map((k) => {
      const m = LAYER_META[k];
      if (m.real) {
        const proc = m.processing ? ` ${m.processing.join('; ')}.` : '';
        const units = m.units ? `, in ${m.units}` : '';
        return (
          `<p><strong>${m.title}</strong> — real: ${m.source} · ${m.date}${units}. ` +
          `${m.sourceResolution} source, ${m.displayResolution} display grid.${proc}</p>`
        );
      }
      return (
        `<p><strong>${m.title}</strong> — ${m.badge.toLowerCase()}: ${m.illustrationNote}. ` +
        `Wired to accept real data (source: ${m.realSource}) via a one-line swap.</p>`
      );
    })
    .join('');
}

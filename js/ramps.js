// ramps.js — SINGLE SOURCE OF TRUTH for the colour ramps.
//
// Consumed by js/config.js (legend gradients), js/sample.js (reverse-lookup for
// click-to-inspect), and the Python overlay builders via
// scripts/generate-placeholders/ramps.py, which parses THIS file. There is no longer a
// duplicated ramp definition to keep in sync.
//
// Format is intentionally simple — one [position, "#hex"] pair per line — so the Python
// regex parser stays robust. Positions are 0..1 and match the LUTs used to colourise the
// exported PNGs, which is what makes the inspect reverse-lookup accurate.

export const RAMPS = {
  viridis: [
    [0.0, '#440154'],
    [0.25, '#3b528b'],
    [0.5, '#21918c'],
    [0.75, '#5ec962'],
    [1.0, '#fde725'],
  ],
  inferno: [
    [0.0, '#000004'],
    [0.25, '#420a68'],
    [0.5, '#932667'],
    [0.75, '#dd513a'],
    [0.9, '#fca50a'],
    [1.0, '#fcffa4'],
  ],
};

// Presentation helper (browser only): build a CSS `linear-gradient(...)` from a ramp's
// [position, hex] stops, so the legend gradients and the story-card swatch derive from the
// same source as the raster LUTs. Written to not match the Python parser's pair/header
// regexes above, so it never interferes with load_ramps().
export function rampGradientCss(stops, angle = '90deg') {
  const parts = stops.map((s) => `${s[1]} ${(s[0] * 100).toFixed(1)}%`).join(', ');
  return `linear-gradient(${angle}, ${parts})`;
}

// stats.js — derive the per-chapter headline figures from the REAL overlay pixels.
//
// Single source for the headline-stat definitions + a pure aggregation helper, shared by the
// compute script (scripts/compute-stats.mjs), the CI honesty guard (test/stats.test.js) and — via
// the numbers those produce — js/metadata.js. Nothing here is fabricated: every figure is a mean
// of the colourised overlay reverse-mapped back to real units, exactly as the inspector/science
// test do (js/sample.js). No DOM, no pngjs import — loads under node --test and in the browser.

import { latLngToPixel, lutIndexForRgb } from './sample.js';

// Named Singapore-only sub-areas, all inside the overlay BOUNDS. Kept small and well inside the
// coast so no masked water pixels dilute the mean, and — crucially — clear of the Johor/Batam land
// the frame also covers, so these are honest Singapore figures, not whole-frame aggregates.
// The forest/industrial anchors match the pinned points the scientific test already trusts.
export const REGIONS = {
  centralCatchment: { south: 1.34, west: 103.78, north: 1.375, east: 103.82 }, // MacRitchie / green heart
  jurongTuas: { south: 1.3, west: 103.63, north: 1.33, east: 103.72 }, // western industrial belt
};

// Mean reconstructed value over the UNMASKED pixels of a lat/lng bbox. `img` is any
// { data, width, height } RGBA source (a pngjs PNG or a canvas ImageData). Returns
// { mean, count } — mean is null if the box holds no data (all masked / off-overlay).
export function regionMeanValue(img, bounds, bbox, lut, displayMin, displayMax) {
  const { data, width, height } = img;
  const nw = latLngToPixel(bounds, { lat: bbox.north, lng: bbox.west }, width, height);
  const se = latLngToPixel(bounds, { lat: bbox.south, lng: bbox.east }, width, height);
  if (!nw || !se) return { mean: null, count: 0 };
  let sum = 0;
  let count = 0;
  for (let py = nw.py; py <= se.py; py++) {
    for (let px = nw.px; px <= se.px; px++) {
      const i = (py * width + px) * 4;
      if (data[i + 3] < 8) continue; // masked (cloud / water / edge) — matches sampleImageNorm
      const norm = lutIndexForRgb(data[i], data[i + 1], data[i + 2], lut) / 255;
      sum += displayMin + norm * (displayMax - displayMin);
      count++;
    }
  }
  return { mean: count ? sum / count : null, count };
}

// Vegetation headline: mean NDVI over the Central Catchment forest ("green heart").
export function greenHeartNDVI(ndviImg, bounds, lut, displayMin, displayMax) {
  return regionMeanValue(ndviImg, bounds, REGIONS.centralCatchment, lut, displayMin, displayMax)
    .mean;
}

// Urban-heat headline: how much hotter the industrial west runs than the forested centre.
// Returns { industrial, forest, gap } in °C.
export function heatGapC(thermalImg, bounds, lut, tminC, tmaxC) {
  const industrial = regionMeanValue(
    thermalImg,
    bounds,
    REGIONS.jurongTuas,
    lut,
    tminC,
    tmaxC
  ).mean;
  const forest = regionMeanValue(
    thermalImg,
    bounds,
    REGIONS.centralCatchment,
    lut,
    tminC,
    tmaxC
  ).mean;
  return { industrial, forest, gap: industrial - forest };
}

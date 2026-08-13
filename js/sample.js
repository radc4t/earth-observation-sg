// sample.js — read a value out of a georeferenced image overlay at a lat/lng.
//
// Used by the click-to-inspect tool. Given an overlay <img> (same-origin, so the canvas is
// not tainted), its geographic bounds, and a colour-ramp LUT, it:
//   1. draws the image to a hidden canvas once and caches the pixels,
//   2. maps the clicked lat/lng to a pixel,
//   3. treats a (near-)transparent pixel as "no data" (cloud/water/edge mask),
//   4. otherwise reverse-looks-up the normalised value (0..1) by finding the nearest LUT
//      colour — the inverse of the colourising step that produced the PNG.
// The caller converts that normalised value into real units (NDVI, °C) from metadata.

function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Build a 256-entry [r,g,b] LUT from [position, "#hex"] stops (matches the Python build_lut).
export function buildLut(stops) {
  const lut = new Array(256);
  for (let k = 0; k < 256; k++) {
    const x = k / 255;
    let j = 0;
    while (j < stops.length - 1 && stops[j + 1][0] < x) j++;
    const [p0, c0] = stops[j];
    const [p1, c1] = stops[Math.min(j + 1, stops.length - 1)];
    const a = hexToRgb(c0);
    const b = hexToRgb(c1);
    const t = p1 > p0 ? (x - p0) / (p1 - p0) : 0;
    lut[k] = [0, 1, 2].map((ci) => Math.round(a[ci] + (b[ci] - a[ci]) * t));
  }
  return lut;
}

const cache = new Map(); // img.src -> { w, h, data }

function pixels(imgEl) {
  let c = cache.get(imgEl.src);
  if (!c) {
    const cv = document.createElement('canvas');
    cv.width = imgEl.naturalWidth;
    cv.height = imgEl.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0);
    c = { w: cv.width, h: cv.height, data: ctx.getImageData(0, 0, cv.width, cv.height).data };
    cache.set(imgEl.src, c);
  }
  return c;
}

// Map a lat/lng to an integer pixel (px,py) in a w×h image over Leaflet bounds
// [[south, west], [north, east]]. Returns null when the point is outside the bounds. Pure — the
// extracted geometry of the sampler, so it can be unit-tested without a canvas.
export function latLngToPixel(bounds, latlng, w, h) {
  const [[s, west], [n, east]] = bounds;
  const { lat, lng } = latlng;
  if (lng < west || lng > east || lat < s || lat > n) return null;
  const px = Math.min(w - 1, Math.max(0, Math.floor(((lng - west) / (east - west)) * w)));
  const py = Math.min(h - 1, Math.max(0, Math.floor(((n - lat) / (n - s)) * h)));
  return { px, py };
}

// Reverse-lookup: the LUT index whose [r,g,b] is nearest the sampled pixel (squared distance) — the
// inverse of the colourising step that produced the PNG. Pure — the extracted core of the inspector.
export function lutIndexForRgb(r, g, b, lut) {
  let best = 0;
  let bestDist = Infinity;
  for (let k = 0; k < lut.length; k++) {
    const dr = r - lut[k][0];
    const dg = g - lut[k][1];
    const db = b - lut[k][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

// bounds: Leaflet [[south, west], [north, east]]. Returns { norm } | { masked:true } | null.
export function sampleImageNorm(imgEl, bounds, latlng, lut) {
  if (!imgEl || !imgEl.naturalWidth) return null;
  const p = latLngToPixel(bounds, latlng, imgEl.naturalWidth, imgEl.naturalHeight);
  if (!p) return { masked: true }; // outside overlay (no need to rasterise the canvas)
  const c = pixels(imgEl);
  const i = (p.py * c.w + p.px) * 4;
  const r = c.data[i];
  const g = c.data[i + 1];
  const b = c.data[i + 2];
  const alpha = c.data[i + 3];
  if (alpha < 8) return { masked: true }; // cloud / water / edge — no reading here
  return { norm: lutIndexForRgb(r, g, b, lut) / 255 };
}

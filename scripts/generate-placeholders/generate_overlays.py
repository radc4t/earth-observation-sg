#!/usr/bin/env python3
"""
generate_overlays.py — reproducible placeholder raster overlays for the
"Earth Observation for Singapore" scrollytelling story.

These are ILLUSTRATIVE placeholders, not real satellite products. They exist so
the map story reads correctly before real Sentinel-2 / Landsat rasters are dropped
in via the swap hooks documented in docs/swap-instructions.md.

Two overlays are produced:
  - ndvi.png     vegetation index (viridis ramp), higher over Central Catchment
  - thermal.png  land-surface temperature (inferno ramp), hotter over industrial /
                 dense-built areas, cooler over water and parkland

Each PNG is exported at OUT_W x OUT_H covering a lng/lat bounding box. The SAME
bounding box must be used as the Leaflet image-overlay bounds
([[south, west], [north, east]]) in js/layers/ndvi.js and js/layers/thermal.js.

------------------------------------------------------------------------------
COLOUR RAMPS come from the single source of truth, js/ramps.js, loaded via ramps.py.
There is nothing to keep in sync by hand — the JS legends/inspect and these Python LUTs
all read the same stops.
------------------------------------------------------------------------------

Run:
    python3 scripts/generate-placeholders/generate_overlays.py
Requires: numpy, Pillow
"""

import os
import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Output geometry
# ---------------------------------------------------------------------------
OUT_W, OUT_H = 1024, 640          # overlay raster resolution
OUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "overlays")
)

# Bounding box covering mainland Singapore (WSEN). MUST match the ImageSource
# `coordinates` in the JS layer modules.
#   west, south, east, north
BBOX = dict(west=103.60, south=1.205, east=104.04, north=1.475)

# ---------------------------------------------------------------------------
# Colour ramps — loaded from the single source of truth (js/ramps.js) via ramps.py.
# ---------------------------------------------------------------------------
from ramps import load_ramps
_R = load_ramps()
VIRIDIS_STOPS = _R["viridis"]
INFERNO_STOPS = _R["inferno"]


def _hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def build_lut(stops, n=256):
    """Linear-interpolate a list of (pos, hex) stops into an n x 3 uint8 LUT."""
    pos = np.array([p for p, _ in stops], dtype=float)
    cols = np.array([_hex_to_rgb(c) for _, c in stops], dtype=float)
    xs = np.linspace(0.0, 1.0, n)
    lut = np.empty((n, 3), dtype=np.uint8)
    for ch in range(3):
        lut[:, ch] = np.interp(xs, pos, cols[:, ch]).round().astype(np.uint8)
    return lut


def norm01(a):
    a = a.astype(float)
    lo, hi = a.min(), a.max()
    return (a - lo) / (hi - lo + 1e-9)


def lnglat_to_px(lng, lat):
    """Map a lng/lat to pixel (col,row) within the BBOX raster (row 0 = north)."""
    col = (lng - BBOX["west"]) / (BBOX["east"] - BBOX["west"]) * (OUT_W - 1)
    row = (BBOX["north"] - lat) / (BBOX["north"] - BBOX["south"]) * (OUT_H - 1)
    return col, row


def radial_field(centres, sigma_px):
    """Sum of Gaussian bumps at given lng/lat centres → smooth scalar field."""
    yy, xx = np.mgrid[0:OUT_H, 0:OUT_W]
    field = np.zeros((OUT_H, OUT_W), dtype=float)
    for lng, lat, weight in centres:
        cx, cy = lnglat_to_px(lng, lat)
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        field += weight * np.exp(-d2 / (2.0 * sigma_px ** 2))
    return field


def apply_ramp(field01, lut):
    """field01 in [0,1] → RGBA uint8 image (alpha ramps up with value)."""
    idx = np.clip((field01 * 255).round().astype(int), 0, 255)
    rgb = lut[idx]
    # Alpha: near-transparent at the low end so the basemap shows through,
    # strengthening toward the high end. Keeps overlays readable, not opaque.
    alpha = (60 + field01 * 165).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, mode="RGBA")


def make_ndvi():
    """Greener (high) over Central Catchment / Bukit Timah & western catchment;
    lower over the dense CBD / industrial south. Illustrative only."""
    rng = np.random.default_rng(42)
    green_centres = [
        (103.805, 1.354, 1.00),   # Central Catchment / MacRitchie
        (103.776, 1.348, 0.95),   # Bukit Timah Nature Reserve
        (103.729, 1.350, 0.70),   # Western Catchment
        (103.815, 1.322, 0.55),   # Botanic Gardens
        (103.980, 1.360, 0.60),   # Pulau Ubin / NE greenery
    ]
    grey_centres = [
        (103.851, 1.283, -0.85),  # CBD / Marina
        (103.700, 1.320, -0.55),  # Jurong industrial
        (103.660, 1.265, -0.75),  # Tuas
        (103.988, 1.356, -0.35),  # Changi
    ]
    field = radial_field(green_centres, sigma_px=70)
    field += radial_field(grey_centres, sigma_px=60)
    field += rng.normal(0, 0.05, (OUT_H, OUT_W))  # subtle texture
    return apply_ramp(norm01(field), build_lut(VIRIDIS_STOPS))


def make_thermal():
    """Hotter (high) over industrial estates & dense HDB; cooler over reservoirs,
    parks and open water. Illustrative land-surface-temperature proxy."""
    rng = np.random.default_rng(7)
    hot_centres = [
        (103.700, 1.320, 1.00),   # Jurong industrial
        (103.660, 1.265, 0.95),   # Tuas
        (103.851, 1.290, 0.80),   # CBD
        (103.902, 1.352, 0.70),   # Tampines / Pasir Ris dense HDB
        (103.760, 1.430, 0.65),   # Woodlands / Sembawang
    ]
    cool_centres = [
        (103.805, 1.354, -0.95),  # MacRitchie reservoir / catchment
        (103.815, 1.322, -0.70),  # Botanic Gardens
        (103.776, 1.348, -0.65),  # Bukit Timah
        (103.900, 1.220, -0.60),  # open water south
        (103.630, 1.230, -0.55),  # water west
    ]
    field = radial_field(hot_centres, sigma_px=65)
    field += radial_field(cool_centres, sigma_px=70)
    field += rng.normal(0, 0.05, (OUT_H, OUT_W))
    return apply_ramp(norm01(field), build_lut(INFERNO_STOPS))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ndvi = make_ndvi()
    thermal = make_thermal()
    ndvi.save(os.path.join(OUT_DIR, "ndvi.png"))
    thermal.save(os.path.join(OUT_DIR, "thermal.png"))
    print(f"Wrote overlays to {OUT_DIR}")
    print(f"  ndvi.png    {ndvi.size}")
    print(f"  thermal.png {thermal.size}")
    print("BBOX (WSEN):", BBOX)
    print("Use as Leaflet image-overlay bounds [[south, west], [north, east]]:")
    w, s, e, n = BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]
    print(f"  [[{s},{w}], [{n},{e}]]")


if __name__ == "__main__":
    main()

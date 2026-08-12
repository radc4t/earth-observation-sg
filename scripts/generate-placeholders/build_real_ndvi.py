#!/usr/bin/env python3
"""
build_real_ndvi.py — produce a REAL Sentinel-2 NDVI overlay for Singapore.

Unlike generate_overlays.py (which makes an *illustrative* placeholder), this script
computes NDVI from genuine Sentinel-2 L2A surface-reflectance bands and colourises it
with the same viridis ramp, georeferenced to the exact overlay bounds used by the map.

Data source: the free, keyless AWS Open Data Sentinel-2 L2A COG mirror, discovered via
the Earth Search STAC API (https://earth-search.aws.element84.com/v1). No account or key.

Pipeline:
  1. STAC search for the least-cloudy S2 L2A scene over the Singapore bbox.
  2. Window-read red (B04) + NIR (B08) 10 m bands and the SCL scene-classification band.
  3. Reproject to EPSG:4326 on the exact overlay grid.
  4. NDVI = (NIR - Red) / (NIR + Red); mask clouds/shadow/snow/nodata via SCL.
  5. Colourise with VIRIDIS_STOPS (kept in sync with js/config.js) and export a PNG.

Resolution note: the Sentinel-2 red/NIR *source* bands are 10 m. The exported PNG is
that source resampled to the display grid (OUT_W px over the bbox) — see DISPLAY_MPP,
which the script prints and which js/metadata.js reports as `displayResolution`. The PNG
must never be described as "10 m"; it is 10 m source at a coarser display resolution.

Output: assets/overlays/ndvi_real.png  (+ prints the date/scene/bounds to wire in).
Requires: rasterio, numpy, Pillow.
"""

import json
import math
import os
import urllib.request

import numpy as np
import rasterio
from PIL import Image
from ramps import load_ramps
from rasterio import windows
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

# ---- overlay geometry (MUST match BBOX in generate_overlays.py / the JS layer bounds)
BBOX = dict(west=103.60, south=1.205, east=104.04, north=1.475)
# The bbox is ~49 km wide. OUT_W sets the DISPLAYED resolution: at 3072 px that is
# ~16 m/px (the Sentinel-2 source bands are 10 m — see the displayed-vs-source note that
# this script prints, and js/metadata.js `displayResolution`). Do not claim "10 m" for
# the exported PNG; it is 10 m source resampled to the display grid.
BBOX_WIDTH_M = 111320.0 * (BBOX["east"] - BBOX["west"]) * math.cos(math.radians(1.34))
OUT_W = 3072
OUT_H = int(round(OUT_W * (BBOX["north"] - BBOX["south"]) / (BBOX["east"] - BBOX["west"])))
DISPLAY_MPP = BBOX_WIDTH_M / OUT_W
OUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "overlays")
)

# viridis stops from the single source of truth (js/ramps.js) via ramps.py.
VIRIDIS_STOPS = load_ramps()["viridis"]
# NDVI display range: below NDVI_LO reads as bare/built, above NDVI_HI as dense canopy.
# Keep in sync with js/metadata.js ndvi.displayMin / displayMax (used by click-to-inspect).
NDVI_LO, NDVI_HI = 0.05, 0.85
# SCL classes to hide (nodata/defective/shadow/water/clouds/cirrus/snow) so the overlay
# reads as land greenery with the basemap water showing through.
SCL_MASK = {0, 1, 3, 6, 8, 9, 10, 11}
STAC = "https://earth-search.aws.element84.com/v1/search"


def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def build_lut(stops, n=256):
    pos = np.array([p for p, _ in stops])
    cols = np.array([_hex(c) for _, c in stops], float)
    xs = np.linspace(0, 1, n)
    lut = np.empty((n, 3), np.uint8)
    for c in range(3):
        lut[:, c] = np.interp(xs, pos, cols[:, c]).round().astype(np.uint8)
    return lut


def find_scene():
    body = {
        "collections": ["sentinel-2-l2a"],
        "bbox": [BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]],
        "datetime": "2023-06-01T00:00:00Z/2025-08-01T00:00:00Z",
        "limit": 100,
    }
    req = urllib.request.Request(
        STAC, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    feats = json.load(urllib.request.urlopen(req, timeout=60))["features"]
    feats.sort(key=lambda f: f["properties"]["eo:cloud_cover"])
    f = feats[0]
    a = f["assets"]
    return {
        "id": f["id"],
        "dt": f["properties"]["datetime"][:10],
        "cloud": f["properties"]["eo:cloud_cover"],
        "red": a["red"]["href"],
        "nir": a["nir"]["href"],
        "scl": a["scl"]["href"],
    }


def read_to_grid(href, dst_transform, dst_crs, resampling):
    """Window-read the source COG over the target bbox at reduced res, then reproject
    onto the exact EPSG:4326 output grid."""
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"
    ):
        with rasterio.open(href) as src:
            # source-CRS bounds of our bbox, buffered slightly
            left, bottom, right, top = transform_bounds(
                dst_crs, src.crs, BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]
            )
            win = (
                windows.from_bounds(left, bottom, right, top, transform=src.transform)
                .round_offsets()
                .round_lengths()
            )
            # read at ~1.5x output res for a manageable, fast decimated read
            oh, ow = OUT_H * 3 // 2, OUT_W * 3 // 2
            arr = src.read(
                1,
                window=win,
                out_shape=(oh, ow),
                resampling=resampling,
                boundless=True,
                fill_value=0,
            )
            src_transform = src.window_transform(win) * rasterio.Affine.scale(
                win.width / ow, win.height / oh
            )
            dst = np.zeros((OUT_H, OUT_W), dtype=arr.dtype)
            reproject(
                arr,
                dst,
                src_transform=src_transform,
                src_crs=src.crs,
                dst_transform=dst_transform,
                dst_crs=dst_crs,
                resampling=resampling,
            )
            return dst


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    scene = find_scene()
    print(f"Scene: {scene['id']}  date={scene['dt']}  tile-cloud={scene['cloud']:.1f}%")

    dst_crs = "EPSG:4326"
    dst_transform = from_bounds(
        BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"], OUT_W, OUT_H
    )

    print("Reading red (B04) ...")
    red = read_to_grid(scene["red"], dst_transform, dst_crs, Resampling.bilinear).astype(np.float32)
    print("Reading nir (B08) ...")
    nir = read_to_grid(scene["nir"], dst_transform, dst_crs, Resampling.bilinear).astype(np.float32)
    print("Reading scl ...")
    scl = read_to_grid(scene["scl"], dst_transform, dst_crs, Resampling.nearest).astype(np.int16)

    nodata = (red == 0) & (nir == 0)
    # Harmonised L2A (post-2022): reflectance = DN/10000 - 0.1; clip negatives to 0.
    r = np.clip(red / 10000.0 - 0.1, 0, None)
    n = np.clip(nir / 10000.0 - 0.1, 0, None)
    denom = n + r
    # Guard: very dark / water pixels (denom ~ 0) give unstable ratios — mark them.
    too_dark = denom < 0.02
    ndvi = np.zeros_like(denom)
    ok = ~too_dark
    ndvi[ok] = np.clip((n[ok] - r[ok]) / denom[ok], -1, 1)

    masked = nodata | too_dark | np.isin(scl, list(SCL_MASK))
    valid = ~masked
    if valid.any():
        print(
            f"NDVI over clear pixels: min={ndvi[valid].min():.2f} "
            f"median={np.median(ndvi[valid]):.2f} max={ndvi[valid].max():.2f} "
            f"clear-coverage={valid.mean() * 100:.1f}%"
        )

    norm = np.clip((ndvi - NDVI_LO) / (NDVI_HI - NDVI_LO), 0, 1)
    lut = build_lut(VIRIDIS_STOPS)
    rgb = lut[np.clip((norm * 255).round().astype(int), 0, 255)]
    alpha = np.clip(70 + norm * 160, 0, 255).astype(np.uint8)
    alpha[masked] = 0
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)

    out = os.path.join(OUT_DIR, "ndvi_real.png")
    # The image holds only ~256 distinct colours (viridis LUT + matching alpha), so a
    # palettised PNG (FASTOCTREE keeps alpha) shrinks it ~5x with no visible loss.
    img = Image.fromarray(rgba)
    try:
        img = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    except Exception:
        pass  # fall back to full RGBA if quantize is unavailable
    img.save(out, optimize=True)
    print(f"Wrote {out}  ({OUT_W}x{OUT_H})")
    print(
        f"Resolution: 10 m Sentinel-2 source, displayed at ~{DISPLAY_MPP:.0f} m/px "
        f"({OUT_W}px over ~{BBOX_WIDTH_M / 1000:.0f} km)"
    )
    print(
        "Leaflet bounds [[south,west],[north,east]]:",
        [[BBOX["south"], BBOX["west"]], [BBOX["north"], BBOX["east"]]],
    )
    scene["sourceResolution"] = "10 m"
    scene["displayResolution"] = f"~{DISPLAY_MPP:.0f} m/px"
    scene["outWidth"] = OUT_W
    json.dump(
        scene, open(os.path.join(os.path.dirname(__file__), "real_ndvi_scene.json"), "w"), indent=2
    )


if __name__ == "__main__":
    main()
